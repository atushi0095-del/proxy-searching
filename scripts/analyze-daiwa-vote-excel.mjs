import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import {
  buildCases,
  classifyReason,
  normalizeHeader,
  normalizeVote,
  summarize
} from "./lib/vote-analysis-utils.mjs";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const SUMMARY_FILE = path.join(ROOT, "data", "generated", "daiwa_am_vote_summary.json");
const CASES_FILE = path.join(ROOT, "data", "generated", "daiwa_am_vote_cases.json");

function parseWorkbook(filePath, source) {
  const workbook = XLSX.readFile(filePath);
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: ""
    });
    const headerIndex = rows.findIndex((row) => {
      const normalized = row.map(normalizeHeader);
      return normalized.includes("コード") && normalized.includes("企業名") && normalized.includes("判断");
    });
    if (headerIndex < 0) continue;
    const header = rows[headerIndex].map(normalizeHeader);
    const indexOf = (name) => header.findIndex((value) => value === name);
    const idx = {
      code: indexOf("コード"),
      name: indexOf("企業名"),
      meetingType: indexOf("総会種類"),
      meetingDate: indexOf("総会日"),
      proposalNumber: indexOf("議案番号"),
      proposalKind: indexOf("議案種類"),
      proposalType: indexOf("議案分類"),
      roleText: indexOf("役員情報"),
      vote: indexOf("判断"),
      conflict: indexOf("利益相反"),
      reason: indexOf("賛否判断理由"),
      splitVote: indexOf("不統一行使")
    };
    for (const [offset, row] of rows.slice(headerIndex + 1).entries()) {
      if (!row[idx.code] || !row[idx.name]) continue;
      const proposalType = String(row[idx.proposalType] ?? "");
      const reason = String(row[idx.reason] ?? "");
      const roleText = String(row[idx.roleText] ?? "");
      records.push({
        investor_id: "daiwa_am",
        source_title: source?.title ?? path.basename(filePath),
        source_url: source?.url ?? "",
        source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
        row_number: headerIndex + offset + 2,
        company_code: String(row[idx.code]),
        company_name: String(row[idx.name]),
        meeting_date: String(row[idx.meetingDate]),
        meeting_type: String(row[idx.meetingType]),
        proposal_number: String(row[idx.proposalNumber]),
        sub_proposal_number: "",
        proposer: String(row[idx.proposalKind]),
        proposal_type: proposalType,
        role_text: roleText,
        vote: normalizeVote(row[idx.vote]),
        reason,
        conflict_note: String(row[idx.conflict] ?? ""),
        split_vote_note: String(row[idx.splitVote] ?? ""),
        issue_types: classifyReason(reason, proposalType, roleText)
      });
    }
  }
  return records;
}

const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const files = (await readdir(SOURCE_DIR).catch(() => []))
  .filter((fileName) => fileName.includes("daiwa_am_vote_result_excel") && fileName.endsWith(".xlsx"));

const records = [];
for (const fileName of files) {
  const filePath = path.join(SOURCE_DIR, fileName);
  const source = manifest.find((item) => item.file_name === fileName);
  const parsed = parseWorkbook(filePath, source);
  records.push(...parsed);
  console.log(`Parsed ${parsed.length} rows from ${fileName}`);
}

await writeFile(SUMMARY_FILE, `${JSON.stringify(summarize(records), null, 2)}\n`, "utf8");
await writeFile(CASES_FILE, `${JSON.stringify(buildCases(records, "大和アセットマネジメント"), null, 2)}\n`, "utf8");

console.log(`Wrote ${SUMMARY_FILE}`);
console.log(`Wrote ${CASES_FILE}`);
