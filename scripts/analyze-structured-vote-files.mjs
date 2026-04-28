import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import {
  buildCases,
  classifyReason,
  normalizeHeader,
  normalizeVote,
  summarize,
} from "./lib/vote-analysis-utils.mjs";

const ROOT = process.cwd();
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);
const OUTPUT_INVESTORS = new Map([
  ["sumitomo_mitsui_trust_am", "三井住友トラスト・アセットマネジメント"],
  ["amova_am", "アモーヴァ・アセットマネジメント"],
  ["mufg_am", "三菱UFJアセットマネジメント"],
  ["nissay_am", "ニッセイアセットマネジメント"],
  ["fidelity_japan", "フィディリティ投信"],
]);
const requestedInvestors = String(args.get("investor") ?? process.env.TARGET_INVESTOR ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const selectedInvestors = requestedInvestors.length > 0
  ? new Map([...OUTPUT_INVESTORS].filter(([investorId]) => requestedInvestors.includes(investorId)))
  : OUTPUT_INVESTORS;

if (requestedInvestors.length > 0 && selectedInvestors.size === 0) {
  throw new Error(`No supported investor selected. Supported: ${[...OUTPUT_INVESTORS.keys()].join(", ")}`);
}

const HEADER_ALIASES = {
  code: ["コード", "銘柄コード", "証券コード"],
  name: ["社名", "銘柄名称", "銘柄", "会社名"],
  meetingDate: ["総会日程", "総会日", "総会日付"],
  meetingType: ["総会種類", "総会種別"],
  proposer: ["提案者", "提案"],
  proposalNumber: ["議案番号", "議案"],
  subProposalNumber: ["候補者番号", "子議案番号"],
  proposalType: ["議案分類", "議案名", "議案区分", "議案種類"],
  vote: ["判断", "賛否", "当社ガイドラインに基づく行使内容・賛否"],
  reason: [
    "理由",
    "判断根拠",
    "主な判断理由",
    "賛否理由",
    "当社ガイドラインに基づく行使内容・判断理由",
  ],
};

function text(value) {
  return String(value ?? "").trim();
}

function normalizeCell(value) {
  return normalizeHeader(value).replace(/\r?\n/g, "");
}

function indexByAliases(header, aliases) {
  const normalized = header.map(normalizeCell);
  return normalized.findIndex((value) =>
    aliases.some((alias) => value === normalizeCell(alias) || value.includes(normalizeCell(alias)))
  );
}

function formatDate(value) {
  if (typeof value === "number" && value > 30000 && value < 70000) {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return `${date.y}${String(date.m).padStart(2, "0")}${String(date.d).padStart(2, "0")}`;
  }
  return text(value).replace(/[^\d]/g, "") || text(value);
}

function workbookFromFile(filePath) {
  if (filePath.toLowerCase().endsWith(".csv")) {
    const buffer = Buffer.from(readFileSync(filePath));
    const csvText = new TextDecoder("shift_jis").decode(buffer);
    return XLSX.read(csvText, { type: "string" });
  }
  return XLSX.readFile(filePath);
}

function contextFromRow(row, context) {
  const joined = row.map(text).join("");
  const companyMatch = joined.match(/[（(株）\s]*([^()（）]+)[（(]([0-9A-Z]{4})[)）]/);
  if (companyMatch) {
    return {
      ...context,
      company_name: companyMatch[1].replace(/^株）/, "").trim(),
      company_code: companyMatch[2],
    };
  }
  const dateMatch = joined.match(/株主総会開催日\s*([0-9]{4})年?([0-9]{2})月?([0-9]{2})日?/);
  if (dateMatch) {
    return {
      ...context,
      meeting_date: `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`,
    };
  }
  return context;
}

function parseSheet(rows, source, sheetName) {
  const records = [];
  let context = {};

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    context = contextFromRow(row, context);
    const header = row.map(normalizeCell);
    const idx = Object.fromEntries(
      Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, indexByAliases(header, aliases)])
    );
    const hasStandardHeader =
      idx.proposalNumber >= 0 &&
      idx.proposalType >= 0 &&
      idx.vote >= 0 &&
      (idx.code >= 0 || context.company_code);
    if (!hasStandardHeader) continue;

    for (const [offset, dataRow] of rows.slice(i + 1).entries()) {
      const nextContext = contextFromRow(dataRow, context);
      if (nextContext !== context && !dataRow[idx.vote]) {
        context = nextContext;
        continue;
      }

      const vote = normalizeVote(dataRow[idx.vote]);
      const proposalNumber = text(dataRow[idx.proposalNumber]);
      const proposalType = text(dataRow[idx.proposalType]);
      if (!vote || vote === "UNKNOWN" || !proposalNumber || !proposalType) continue;

      const companyCode = idx.code >= 0 ? text(dataRow[idx.code]) : context.company_code;
      const companyName = idx.name >= 0 ? text(dataRow[idx.name]) : context.company_name;
      if (!companyCode && !companyName) continue;

      const reason = idx.reason >= 0 ? text(dataRow[idx.reason]) : "";
      const roleText = idx.subProposalNumber >= 0 ? text(dataRow[idx.subProposalNumber]) : "";
      records.push({
        investor_id: source.investor_id,
        source_title: source.title ?? source.file_name,
        source_url: source.url ?? "",
        source_file: source.file_path ?? "",
        sheet_name: sheetName,
        row_number: i + offset + 2,
        company_code: companyCode,
        company_name: companyName,
        meeting_date: idx.meetingDate >= 0 ? formatDate(dataRow[idx.meetingDate]) : context.meeting_date ?? "",
        meeting_type: idx.meetingType >= 0 ? text(dataRow[idx.meetingType]) : "",
        proposer: idx.proposer >= 0 ? text(dataRow[idx.proposer]) : "",
        proposal_number: proposalNumber,
        sub_proposal_number: roleText,
        proposal_type: proposalType,
        role_text: roleText,
        vote,
        reason,
        issue_types: classifyReason(reason, proposalType, roleText),
      });
    }
    break;
  }

  return records;
}

function parseWorkbook(filePath, source) {
  const workbook = workbookFromFile(filePath);
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: "",
    });
    records.push(...parseSheet(rows, source, sheetName));
  }
  return records;
}

const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const grouped = new Map([...selectedInvestors.keys()].map((investorId) => [investorId, []]));

for (const source of manifest) {
  if (!grouped.has(source.investor_id)) continue;
  if (source.kind !== "vote_result_excel") continue;
  if (!source.file_path) continue;
  try {
    const filePath = path.join(ROOT, source.file_path);
    const parsed = parseWorkbook(filePath, source);
    grouped.get(source.investor_id).push(...parsed);
    console.log(`Parsed ${parsed.length} rows from ${source.file_name}`);
  } catch (error) {
    console.warn(`Skipped ${source.file_name}: ${error instanceof Error ? error.message : error}`);
  }
}

for (const [investorId, records] of grouped.entries()) {
  const summaryFile = path.join(ROOT, "data", "generated", `${investorId}_vote_summary.json`);
  const casesFile = path.join(ROOT, "data", "generated", `${investorId}_vote_cases.json`);
  await writeFile(summaryFile, `${JSON.stringify(summarize(records), null, 2)}\n`, "utf8");
  await writeFile(casesFile, `${JSON.stringify(buildCases(records, selectedInvestors.get(investorId)), null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, casesFile)} with ${records.length} records`);
}
