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
const SUMMARY_FILE = path.join(ROOT, "data", "generated", "resona_am_vote_summary.json");
const CASES_FILE = path.join(ROOT, "data", "generated", "resona_am_vote_cases.json");

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
      return normalized.includes("ｺｰﾄﾞ") && normalized.includes("投資先") && normalized.includes("行使内容");
    });
    if (headerIndex < 0) continue;
    const header = rows[headerIndex].map(normalizeHeader);
    const indexOf = (name) => header.findIndex((value) => value === name);
    const idx = {
      code: indexOf("ｺｰﾄﾞ"),
      name: indexOf("投資先"),
      meetingDate: indexOf("総会日"),
      meetingType: indexOf("総会種類"),
      proposalNumber: indexOf("議案番号"),
      subProposalNumber: indexOf("子議案"),
      proposalKind: indexOf("議案種類"),
      proposalType: indexOf("議案分類"),
      vote: indexOf("行使内容"),
      reason: indexOf("賛否の理由")
    };
    for (const [offset, row] of rows.slice(headerIndex + 1).entries()) {
      if (!row[idx.code] || !row[idx.name]) continue;
      const proposalType = String(row[idx.proposalType] ?? "");
      const reason = String(row[idx.reason] ?? "");
      records.push({
        investor_id: "resona_am",
        source_title: source?.title ?? path.basename(filePath),
        source_url: source?.url ?? "",
        source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
        row_number: headerIndex + offset + 2,
        company_code: String(row[idx.code]),
        company_name: String(row[idx.name]),
        meeting_date: String(row[idx.meetingDate]),
        meeting_type: String(row[idx.meetingType]),
        proposal_number: String(row[idx.proposalNumber]),
        sub_proposal_number: String(row[idx.subProposalNumber]),
        proposer: String(row[idx.proposalKind]),
        proposal_type: proposalType,
        vote: normalizeVote(row[idx.vote]),
        reason,
        issue_types: classifyReason(reason, proposalType)
      });
    }
  }
  return records;
}

const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const files = (await readdir(SOURCE_DIR).catch(() => []))
  .filter((fileName) => fileName.includes("resona_am_vote_result_excel") && /\.(xlsx|xls)$/i.test(fileName));

const records = [];
for (const fileName of files) {
  const filePath = path.join(SOURCE_DIR, fileName);
  const source = manifest.find((item) => item.file_name === fileName);
  const parsed = parseWorkbook(filePath, source);
  records.push(...parsed);
  console.log(`Parsed ${parsed.length} rows from ${fileName}`);
}

await writeFile(SUMMARY_FILE, `${JSON.stringify(summarize(records), null, 2)}\n`, "utf8");
await writeFile(CASES_FILE, `${JSON.stringify(buildCases(records, "りそなアセットマネジメント"), null, 2)}\n`, "utf8");

console.log(`Wrote ${SUMMARY_FILE}`);
console.log(`Wrote ${CASES_FILE}`);
