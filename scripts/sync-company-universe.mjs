import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const UNIVERSE_FILE = path.join(DATA_DIR, "company_universe.json");
const COMPANIES_FILE = path.join(DATA_DIR, "companies.json");
const DOCUMENT_SOURCES_FILE = path.join(DATA_DIR, "document_sources.json");

const documentTemplates = [
  {
    document_type: "ir_top",
    document_label: "IRトップ",
    titleSuffix: "IR情報",
    notes: "公式IRページ。招集通知、統合報告書、有価証券報告書、株主総会関連資料の探索起点。"
  },
  {
    document_type: "notice_of_meeting",
    document_label: "招集通知",
    titleSuffix: "定時株主総会 招集ご通知",
    notes: "取締役候補者、略歴、独立性、在任年数、出席率、議案内容の抽出対象。URLは次工程で公式IRまたはTDnet/EDINETから補完。"
  },
  {
    document_type: "annual_securities_report",
    document_label: "有価証券報告書",
    titleSuffix: "有価証券報告書",
    notes: "ROE、政策保有株式、役員情報、コーポレートガバナンス情報の抽出対象。URLはEDINET等で補完。"
  },
  {
    document_type: "corporate_governance_report",
    document_label: "コーポレートガバナンス報告書",
    titleSuffix: "コーポレートガバナンス報告書",
    notes: "取締役会構成、独立社外取締役比率、委員会、女性役員等の抽出対象。"
  },
  {
    document_type: "company_vote_result",
    document_label: "議決権行使結果（会社公表）",
    titleSuffix: "定時株主総会 議決権行使結果",
    notes: "会社公表の賛否集計。投資家別行使結果ではないため、FACTの補助資料として扱う。"
  }
];

function loadJson(file) {
  return readFile(file, "utf8").then((raw) => JSON.parse(raw));
}

function uniqueBy(items, keyFn) {
  return [...new Map(items.map((item) => [keyFn(item), item])).values()];
}

function companyRecord(item) {
  return {
    company_code: item.company_code,
    company_name: item.company_name,
    fiscal_year_end: item.fiscal_year_end,
    market: item.market,
    sector: item.sector,
    source_url: item.source_url
  };
}

function documentRecords(item, meetingYear = 2025) {
  return documentTemplates.map((template) => ({
    source_id: `DOC_${item.company_code}_${meetingYear}_${template.document_type.toUpperCase()}`,
    company_code: item.company_code,
    meeting_year: meetingYear,
    document_type: template.document_type,
    document_label: template.document_label,
    title: `${item.company_name} ${template.titleSuffix}`,
    url: template.document_type === "ir_top" ? item.source_url : "",
    filing_date: "",
    notes: template.notes
  }));
}

const universe = await loadJson(UNIVERSE_FILE);
const companies = await loadJson(COMPANIES_FILE);
const documentSources = await loadJson(DOCUMENT_SOURCES_FILE);

const mergedCompanies = uniqueBy(
  [...companies, ...universe.map(companyRecord)],
  (item) => item.company_code
).sort((a, b) => a.company_code.localeCompare(b.company_code));

const generatedDocumentSources = universe.flatMap((item) => documentRecords(item));
const mergedDocumentSources = uniqueBy(
  [...documentSources, ...generatedDocumentSources],
  (item) => item.source_id
).sort((a, b) => a.company_code.localeCompare(b.company_code) || a.source_id.localeCompare(b.source_id));

await writeFile(COMPANIES_FILE, `${JSON.stringify(mergedCompanies, null, 2)}\n`, "utf8");
await writeFile(DOCUMENT_SOURCES_FILE, `${JSON.stringify(mergedDocumentSources, null, 2)}\n`, "utf8");

console.log(`Synced ${mergedCompanies.length} companies`);
console.log(`Synced ${mergedDocumentSources.length} document source placeholders`);
