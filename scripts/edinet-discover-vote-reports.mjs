// EDINET から臨時報告書（docTypeCode=180）を検索して一覧化する。
// 定時株主総会後に提出される臨時報告書（開示府令19条2項9号の2）には
// 議案ごと・取締役候補者ごとの賛成・反対・棄権数と賛成割合が記載される。
// 実際に議決権行使結果を含むかどうかは edinet-extract-vote-results.mjs が本文を見て判定する。
//
// Usage:
//   EDINET_API_KEY=... node scripts/edinet-discover-vote-reports.mjs --from=2025-06-15 --to=2025-07-15
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const COMPANIES_FILE = path.join(ROOT, "data", "companies.json");
const OUTPUT_FILE = path.join(ROOT, "data", "generated", "edinet_vote_reports.json");
const API_BASE = "https://api.edinet-fsa.go.jp/api/v2";
const API_KEY = process.env.EDINET_API_KEY;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);

function usage() {
  console.log(`Usage:
  EDINET_API_KEY=... node scripts/edinet-discover-vote-reports.mjs --from=2025-06-15 --to=2025-07-15

Options:
  --from=YYYY-MM-DD     Required. 総会後2〜5営業日に提出されるため総会集中日+2週間を推奨
  --to=YYYY-MM-DD       Required
  --company=8088        Optional. 特定企業のみ
  --limit=9999          Optional. 今回追加する上限件数
  --delay=1500          Optional. APIリクエスト間隔(ms)
`);
}

if (!API_KEY) {
  usage();
  throw new Error("EDINET_API_KEY is not set.");
}

const from = args.get("from");
const to = args.get("to");
if (!from || !to) {
  usage();
  throw new Error("--from and --to are required.");
}

const limit = Number(args.get("limit") ?? 9999);
const delay = Number(args.get("delay") ?? 1500);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateRange(fromDate, toDate) {
  const dates = [];
  const current = new Date(`${fromDate}T00:00:00+09:00`);
  const end = new Date(`${toDate}T00:00:00+09:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime()) || current > end) {
    throw new Error("Invalid --from/--to date range.");
  }
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

async function fetchDocumentList(date) {
  const url = new URL(`${API_BASE}/documents.json`);
  url.searchParams.set("date", date);
  url.searchParams.set("type", "2");
  url.searchParams.set("Subscription-Key", API_KEY);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EDINET documents list failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const companies = JSON.parse(await fs.readFile(COMPANIES_FILE, "utf8"));
const companyArg = args.get("company");
const selected = companyArg
  ? companies.filter((company) => String(company.company_code) === String(companyArg))
  : companies;
// EDINET の secCode は5桁（証券コード+0）
const secCodeMap = new Map(selected.map((company) => [`${company.company_code}0`, company]));

let existingReports = [];
try {
  const existing = JSON.parse(await fs.readFile(OUTPUT_FILE, "utf8"));
  existingReports = Array.isArray(existing.reports) ? existing.reports : [];
  console.log(`既存 edinet_vote_reports.json: ${existingReports.length} 件を読み込み`);
} catch { /* 初回 */ }
const existingDocIds = new Set(existingReports.map((report) => report.doc_id));

const newReports = [];
let apiCalls = 0;

for (const date of dateRange(from, to)) {
  let payload;
  try {
    payload = await fetchDocumentList(date);
    apiCalls++;
  } catch (e) {
    console.warn(`\n  ⚠ ${date}: ${e.message}`);
    await sleep(delay);
    continue;
  }
  const results = Array.isArray(payload.results) ? payload.results : [];
  for (const doc of results) {
    if (String(doc.docTypeCode ?? "") !== "180") continue; // 臨時報告書のみ
    const secCode = String(doc.secCode ?? "");
    const company = secCodeMap.get(secCode);
    if (!company) continue;
    const docId = doc.docID ?? "";
    if (!docId || existingDocIds.has(docId)) continue;
    newReports.push({
      company_code: company.company_code,
      company_name: company.company_name,
      edinet_code: doc.edinetCode ?? "",
      sec_code: secCode,
      doc_id: docId,
      doc_description: doc.docDescription ?? "",
      submit_date_time: doc.submitDateTime ?? "",
      filer_name: doc.filerName ?? "",
      // pending: 未処理 / parsed: 行使結果を抽出済み / no_vote_data: 行使結果以外の臨報 / error
      status: "pending",
      discovered_at: new Date().toISOString(),
    });
    existingDocIds.add(docId);
    if (newReports.length >= limit) break;
  }
  if (newReports.length >= limit) break;

  process.stdout.write(`\r  ${date} | 新規: ${newReports.length} 件 (API: ${apiCalls}回)   `);
  await sleep(delay);
}

const merged = [...existingReports, ...newReports]
  .sort((a, b) => (b.submit_date_time ?? "").localeCompare(a.submit_date_time ?? ""));

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(
  OUTPUT_FILE,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      api: "EDINET API v2",
      purpose: "臨時報告書（議決権行使結果）の候補一覧。extract で本文を確認して賛成率を抽出する。",
      request: { from, to, company: companyArg ?? null, limit, delay },
      total: merged.length,
      new_this_run: newReports.length,
      reports: merged,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`\n✅ edinet_vote_reports.json: 合計 ${merged.length} 件（今回追加: ${newReports.length} 件）`);
