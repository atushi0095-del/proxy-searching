// 行使結果レコードを SQLite に変換する。
// 投資家ページはこの DB に対してサーバー側でフィルタするため、
// 数百MBの JSON をリクエスト毎に読む・ブラウザへ送ることがなくなる。
// 依存追加なし（Node 22.5+ 組み込みの node:sqlite を使用）。
import { readFile, readdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const RECORDS_DIR = path.join(ROOT, "data", "generated", "opposition_records_by_investor");
const DB_PATH = path.join(ROOT, "data", "generated", "analysis.db");
const DB_TMP_PATH = `${DB_PATH}.build`;

function meetingYearFrom(meetingDate, proposalType) {
  const match = String(meetingDate ?? "").match(/(\d{4})/);
  if (match) return Number(match[1]);
  const m2 = String(proposalType ?? "").match(/^(\d{4})/);
  if (m2) return Number(m2[1]);
  return 2025;
}

function isAgainstVote(vote) {
  const v = String(vote ?? "");
  return v === "反対" || v === "判断" || v.includes("反対") || v.includes("該当");
}

function isDirectorElection(record) {
  const text = `${record.proposal_type ?? ""} ${record.proposal_title_normalized ?? ""}`;
  return /取締役|監査等委員|選任|選解任/.test(text);
}

function buildSearchText(record) {
  return [
    record.company_code,
    record.company_name,
    record.proposal_type,
    record.director_or_role,
    record.target_label,
    record.match_method,
    record.matched_director_name,
    record.matched_director_title,
    ...(record.matched_director_attributes ?? []),
    record.reason,
    ...(record.detail_tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function main() {
  if (!existsSync(RECORDS_DIR)) {
    console.log(`Skip: ${path.relative(ROOT, RECORDS_DIR)} not found. Run split:opposition-records first.`);
    return;
  }

  await rm(DB_TMP_PATH, { force: true });
  const db = new DatabaseSync(DB_TMP_PATH);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE vote_records (
      id INTEGER PRIMARY KEY,
      investor_id TEXT NOT NULL,
      company_code TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      meeting_date TEXT NOT NULL DEFAULT '',
      meeting_year INTEGER NOT NULL,
      proposal_number TEXT NOT NULL DEFAULT '',
      resolution_number TEXT,
      candidate_number TEXT,
      proposal_type TEXT NOT NULL DEFAULT '',
      proposal_title_normalized TEXT,
      director_or_role TEXT NOT NULL DEFAULT '',
      vote TEXT NOT NULL DEFAULT '',
      issue_type TEXT NOT NULL DEFAULT '',
      detail_tags TEXT,
      target_label TEXT,
      target_resolution_type TEXT,
      target_candidate_number TEXT,
      match_method TEXT,
      target_confidence TEXT,
      target_notes TEXT,
      matched_director_id TEXT,
      matched_director_name TEXT,
      matched_director_title TEXT,
      matched_director_attributes TEXT,
      director_match_method TEXT,
      director_match_confidence TEXT,
      director_match_notes TEXT,
      reason TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      source_title TEXT NOT NULL DEFAULT '',
      convocation_notice_url TEXT,
      is_against INTEGER NOT NULL DEFAULT 0,
      has_reason INTEGER NOT NULL DEFAULT 0,
      is_director_election INTEGER NOT NULL DEFAULT 0,
      search_text TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE investor_facets (
      investor_id TEXT NOT NULL,
      facet TEXT NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE investor_summary (
      investor_id TEXT PRIMARY KEY,
      total INTEGER NOT NULL,
      against_count INTEGER NOT NULL,
      for_count INTEGER NOT NULL,
      for_with_reason_count INTEGER NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT INTO vote_records (
      investor_id, company_code, company_name, meeting_date, meeting_year,
      proposal_number, resolution_number, candidate_number, proposal_type, proposal_title_normalized,
      director_or_role, vote, issue_type, detail_tags,
      target_label, target_resolution_type, target_candidate_number, match_method, target_confidence, target_notes,
      matched_director_id, matched_director_name, matched_director_title, matched_director_attributes,
      director_match_method, director_match_confidence, director_match_notes,
      reason, source_url, source_title, convocation_notice_url,
      is_against, has_reason, is_director_election, search_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const files = (await readdir(RECORDS_DIR)).filter((name) => name.endsWith(".json"));
  let grandTotal = 0;

  for (const file of files) {
    const investorId = path.basename(file, ".json");
    const raw = JSON.parse(await readFile(path.join(RECORDS_DIR, file), "utf8"));
    const records = raw.records ?? [];

    db.exec("BEGIN");
    const issueTypes = new Set();
    const detailTags = new Set();
    const meetingYears = new Set();
    let againstCount = 0;
    let forCount = 0;
    let forWithReasonCount = 0;

    for (const record of records) {
      const year = meetingYearFrom(record.meeting_date, record.proposal_type);
      const against = isAgainstVote(record.vote) ? 1 : 0;
      const hasReason = String(record.reason ?? "").trim().length > 0 ? 1 : 0;
      insert.run(
        record.investor_id ?? investorId,
        String(record.company_code ?? ""),
        record.company_name ?? "",
        String(record.meeting_date ?? ""),
        year,
        String(record.proposal_number ?? ""),
        record.resolution_number != null ? String(record.resolution_number) : null,
        record.candidate_number != null ? String(record.candidate_number) : null,
        record.proposal_type ?? "",
        record.proposal_title_normalized ?? null,
        record.director_or_role ?? "",
        record.vote ?? "",
        record.issue_type ?? "",
        record.detail_tags?.length ? JSON.stringify(record.detail_tags) : null,
        record.target_label ?? null,
        record.target_resolution_type ?? null,
        record.target_candidate_number != null ? String(record.target_candidate_number) : null,
        record.match_method ?? null,
        record.target_confidence ?? null,
        record.target_notes ?? null,
        record.matched_director_id ?? null,
        record.matched_director_name ?? null,
        record.matched_director_title ?? null,
        record.matched_director_attributes?.length ? JSON.stringify(record.matched_director_attributes) : null,
        record.director_match_method ?? null,
        record.director_match_confidence ?? null,
        record.director_match_notes ?? null,
        record.reason ?? "",
        record.source_url ?? "",
        record.source_title ?? "",
        record.convocation_notice_url ?? null,
        against,
        hasReason,
        isDirectorElection(record) ? 1 : 0,
        buildSearchText(record)
      );

      if (record.issue_type) issueTypes.add(record.issue_type);
      for (const tag of record.detail_tags ?? []) detailTags.add(tag);
      meetingYears.add(String(year));
      if (against) againstCount++;
      if (record.vote === "賛成") {
        forCount++;
        if (hasReason) forWithReasonCount++;
      }
    }

    const insertFacet = db.prepare("INSERT INTO investor_facets (investor_id, facet, value) VALUES (?, ?, ?)");
    for (const value of [...issueTypes].sort()) insertFacet.run(investorId, "issue_type", value);
    for (const value of [...detailTags].sort()) insertFacet.run(investorId, "detail_tag", value);
    for (const value of [...meetingYears].sort().reverse()) insertFacet.run(investorId, "meeting_year", value);
    db.prepare("INSERT INTO investor_summary (investor_id, total, against_count, for_count, for_with_reason_count) VALUES (?, ?, ?, ?, ?)")
      .run(investorId, records.length, againstCount, forCount, forWithReasonCount);
    db.exec("COMMIT");

    grandTotal += records.length;
    console.log(`  ${investorId}: ${records.length.toLocaleString()} records`);
  }

  db.exec(`
    CREATE INDEX idx_records_investor_year ON vote_records(investor_id, meeting_year);
    CREATE INDEX idx_records_investor_company ON vote_records(investor_id, company_code, meeting_year);
    CREATE INDEX idx_records_investor_issue ON vote_records(investor_id, issue_type);
    CREATE INDEX idx_records_company ON vote_records(company_code, meeting_year);
    PRAGMA optimize;
  `);
  db.close();

  await rm(DB_PATH, { force: true });
  await rename(DB_TMP_PATH, DB_PATH);
  console.log(`analysis.db built: ${grandTotal.toLocaleString()} records from ${files.length} investors`);
}

await main();
