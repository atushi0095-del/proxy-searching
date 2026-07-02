// EDINET 臨時報告書（議決権行使結果）から議案ごと・候補者ごとの
// 賛成・反対・棄権数と賛成割合を抽出する。
// 入力: data/generated/edinet_vote_reports.json（edinet-discover-vote-reports.mjs が生成）
// 出力: data/generated/agm_vote_results/{company_code}.json（企業別シャード）
//       data/generated/agm_vote_results_index.json（サマリー索引）
//
// Usage:
//   EDINET_API_KEY=... node scripts/edinet-extract-vote-results.mjs --limit=200 --delay=2000
import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { parseTables, cellText, extractRecordsFromTable, extractMeetingDate } from "./lib/vote-report-parser.mjs";

const ROOT = process.cwd();
const REPORTS_FILE = path.join(ROOT, "data", "generated", "edinet_vote_reports.json");
const OUTPUT_DIR = path.join(ROOT, "data", "generated", "agm_vote_results");
const INDEX_FILE = path.join(ROOT, "data", "generated", "agm_vote_results_index.json");
const API_BASE = "https://api.edinet-fsa.go.jp/api/v2";
const API_KEY = process.env.EDINET_API_KEY;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);

const limit = Number(args.get("limit") ?? 9999);
const delay = Number(args.get("delay") ?? 2000);
const companyFilter = args.get("company") ?? null;

if (!API_KEY) {
  throw new Error("EDINET_API_KEY is not set.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── ZIP reader（edinet-extract-financials.mjs と同一実装・Node組み込みのみ）──
function unzipEntries(buffer) {
  const entries = [];
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return entries;

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const numEntries = buffer.readUInt16LE(eocdOffset + 8);

  let pos = cdOffset;
  for (let i = 0; i < numEntries && pos + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(pos + 10);
    const compSize = buffer.readUInt32LE(pos + 20);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.slice(pos + 46, pos + 46 + nameLen).toString("utf8");
    pos += 46 + nameLen + extraLen + commentLen;

    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compData = buffer.slice(dataStart, dataStart + compSize);
    try {
      const data = method === 0 ? compData : inflateRawSync(compData);
      entries.push({ name, data });
    } catch { /* 展開失敗はスキップ */ }
  }
  return entries;
}

// ── EDINET ダウンロード ──────────────────────────────
async function downloadDoc(docId) {
  const url = new URL(`${API_BASE}/documents/${docId}`);
  url.searchParams.set("type", "1"); // 提出本文書 ZIP
  url.searchParams.set("Subscription-Key", API_KEY);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const body = await response.json();
    throw new Error(`API error: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function processReport(report) {
  const zip = await downloadDoc(report.doc_id);
  const entries = unzipEntries(zip);
  const htmlEntries = entries.filter((entry) => /PublicDoc.*\.(html?|htm)$/i.test(entry.name));
  if (htmlEntries.length === 0) {
    return { status: "no_vote_data", records: [], meetingDate: null, note: "PublicDoc html not found" };
  }

  let allRecords = [];
  let meetingDate = null;
  let hasVoteSection = false;

  for (const entry of htmlEntries) {
    const html = entry.data.toString("utf8");
    const plain = cellText(html);
    if (!/議決権.{0,10}(行使|の数)|賛成.{0,20}反対/.test(plain)) continue;
    if (/決議事項に対する賛成|議決権行使の結果|賛成、反対及び棄権/.test(plain)) hasVoteSection = true;
    meetingDate ??= extractMeetingDate(plain);
    for (const table of parseTables(html)) {
      const records = extractRecordsFromTable(table);
      if (records.length > 0) allRecords = allRecords.concat(records);
    }
  }

  if (!hasVoteSection || allRecords.length === 0) {
    return { status: "no_vote_data", records: [], meetingDate, note: hasVoteSection ? "vote table not parsed" : "not a vote-result report" };
  }

  // 同一議案・候補者の重複排除（複数ファイルに同じ表があるケース）
  const seen = new Set();
  const deduped = allRecords.filter((record) => {
    const key = `${record.proposal_no}:${record.candidate_name ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { status: "parsed", records: deduped, meetingDate };
}

// ── シャード書き込み ─────────────────────────────────
async function mergeIntoShard(companyCode, companyName, meetingDate, docId, submitDateTime, records) {
  const shardPath = path.join(OUTPUT_DIR, `${companyCode}.json`);
  let shard = { company_code: companyCode, company_name: companyName, meetings: [] };
  try {
    shard = JSON.parse(await fs.readFile(shardPath, "utf8"));
  } catch { /* 新規 */ }

  const meetingKey = meetingDate ?? submitDateTime?.slice(0, 10) ?? "unknown";
  shard.meetings = shard.meetings.filter((meeting) => meeting.meeting_date !== meetingKey);
  shard.meetings.push({
    meeting_date: meetingKey,
    meeting_year: Number(meetingKey.slice(0, 4)) || null,
    doc_id: docId,
    submit_date_time: submitDateTime,
    source: `https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?${docId}`,
    proposals: records,
  });
  shard.meetings.sort((a, b) => String(b.meeting_date).localeCompare(String(a.meeting_date)));
  shard.company_name = companyName;
  shard.updated_at = new Date().toISOString();

  await fs.writeFile(shardPath, `${JSON.stringify(shard, null, 2)}\n`, "utf8");
}

async function rebuildIndex() {
  const files = (await fs.readdir(OUTPUT_DIR)).filter((name) => name.endsWith(".json"));
  const index = [];
  for (const file of files) {
    const shard = JSON.parse(await fs.readFile(path.join(OUTPUT_DIR, file), "utf8"));
    const years = shard.meetings.map((meeting) => meeting.meeting_year).filter(Boolean);
    const allPcts = shard.meetings.flatMap((meeting) =>
      meeting.proposals.map((proposal) => proposal.approval_pct).filter((pct) => pct !== null)
    );
    index.push({
      company_code: shard.company_code,
      company_name: shard.company_name,
      meeting_count: shard.meetings.length,
      years: [...new Set(years)].sort(),
      min_approval_pct: allPcts.length ? Math.min(...allPcts) : null,
      proposal_count: shard.meetings.reduce((sum, meeting) => sum + meeting.proposals.length, 0),
    });
  }
  index.sort((a, b) => (a.min_approval_pct ?? 101) - (b.min_approval_pct ?? 101));
  await fs.writeFile(
    INDEX_FILE,
    `${JSON.stringify({ generated_at: new Date().toISOString(), total_companies: index.length, companies: index }, null, 2)}\n`,
    "utf8"
  );
}

// ── メイン ───────────────────────────────────────────
const reportsFile = JSON.parse(await fs.readFile(REPORTS_FILE, "utf8"));
const reports = reportsFile.reports ?? [];
let pending = reports.filter((report) => report.status === "pending");
if (companyFilter) pending = pending.filter((report) => String(report.company_code) === String(companyFilter));
pending = pending.slice(0, limit);

console.log(`対象: ${pending.length} 件（全 ${reports.length} 件中 pending を処理）`);
await fs.mkdir(OUTPUT_DIR, { recursive: true });

let parsedCount = 0;
let noDataCount = 0;
let errorCount = 0;

for (const [i, report] of pending.entries()) {
  try {
    const { status, records, meetingDate, note } = await processReport(report);
    report.status = status;
    report.processed_at = new Date().toISOString();
    if (note) report.note = note;
    if (status === "parsed") {
      report.meeting_date = meetingDate;
      report.record_count = records.length;
      await mergeIntoShard(report.company_code, report.company_name, meetingDate, report.doc_id, report.submit_date_time, records);
      parsedCount++;
    } else {
      noDataCount++;
    }
  } catch (e) {
    report.status = "error";
    report.note = e.message?.slice(0, 200);
    errorCount++;
    // レート制限系エラーは中断
    if (/429|403/.test(e.message ?? "")) {
      console.error(`\n⚠ レート制限の可能性があるため中断: ${e.message}`);
      break;
    }
  }
  process.stdout.write(`\r  ${i + 1}/${pending.length} | 抽出: ${parsedCount} / 対象外: ${noDataCount} / エラー: ${errorCount}   `);
  await sleep(delay);
}

// 状態を書き戻し
reportsFile.generated_at = new Date().toISOString();
await fs.writeFile(REPORTS_FILE, `${JSON.stringify(reportsFile, null, 2)}\n`, "utf8");

await rebuildIndex();
console.log(`\n✅ 完了: 抽出 ${parsedCount} 件 / 行使結果なし ${noDataCount} 件 / エラー ${errorCount} 件`);
console.log(`   シャード: data/generated/agm_vote_results/ | 索引: agm_vote_results_index.json`);
