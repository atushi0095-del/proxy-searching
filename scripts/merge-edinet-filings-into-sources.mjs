import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FILINGS_FILE = path.join(ROOT, "data", "generated", "edinet_filings.json");
const DOCUMENT_SOURCES_FILE = path.join(ROOT, "data", "document_sources.json");
const COMPANIES_FILE = path.join(ROOT, "data", "companies.json");

function normalizeCode(value) {
  return String(value ?? "").trim();
}

function sourceId(code, year) {
  return `DOC_${code}_${year}_ANNUAL_SECURITIES_REPORT`;
}

function fiscalYearFromFiling(filing) {
  const end = String(filing.period_end ?? "").trim();
  const submit = String(filing.submit_date_time ?? "").slice(0, 10);
  const value = end || submit;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : 2025;
}

function labelForAnnualReport(year) {
  return `${year}年期 有価証券報告書`;
}

function notesFor(filing) {
  const submitted = filing.submit_date_time ? `提出日時: ${filing.submit_date_time}。` : "";
  const period = filing.period_start || filing.period_end
    ? `対象期間: ${filing.period_start || "-"}〜${filing.period_end || "-"}。`
    : "";
  return [
    "EDINET APIで有価証券報告書のdoc_idを特定済み。",
    submitted,
    period,
    "本文・XBRLの取得とROE、政策保有株式、役員情報の抽出は次工程で実施。",
  ].filter(Boolean).join(" ");
}

async function readJsonIfExists(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

const filingsData = await readJsonIfExists(FILINGS_FILE, { filings: [] });
const filings = Array.isArray(filingsData.filings) ? filingsData.filings : [];
const documentSources = await readJsonIfExists(DOCUMENT_SOURCES_FILE, []);
const companies = await readJsonIfExists(COMPANIES_FILE, []);
const companyByCode = new Map(companies.map((company) => [normalizeCode(company.company_code), company]));
const byId = new Map(documentSources.map((source) => [source.source_id, source]));

let added = 0;
let updated = 0;

for (const filing of filings) {
  const code = normalizeCode(filing.company_code);
  if (!code || !filing.doc_id) continue;
  const company = companyByCode.get(code);
  const year = fiscalYearFromFiling(filing);
  const id = sourceId(code, year);
  const existing = byId.get(id);
  const base = {
    source_id: id,
    company_code: code,
    meeting_year: year,
    document_type: "annual_securities_report",
    document_label: labelForAnnualReport(year),
    title: `${company?.company_name ?? filing.company_name ?? code} ${labelForAnnualReport(year)}`,
    url: company?.source_url ?? "",
    filing_date: String(filing.submit_date_time ?? "").slice(0, 10),
    edinet_doc_id: filing.doc_id,
    edinet_code: filing.edinet_code ?? "",
    sec_code: filing.sec_code ?? "",
    period_start: filing.period_start ?? "",
    period_end: filing.period_end ?? "",
    source: "EDINET API v2 documents.json",
    confidence: "High",
    notes: notesFor(filing),
  };

  if (!existing) {
    documentSources.push(base);
    byId.set(id, base);
    added += 1;
    continue;
  }

  const before = JSON.stringify(existing);
  existing.document_label = base.document_label;
  existing.title = base.title;
  existing.filing_date = base.filing_date || existing.filing_date || "";
  existing.edinet_doc_id = base.edinet_doc_id;
  existing.edinet_code = base.edinet_code;
  existing.sec_code = base.sec_code;
  existing.period_start = base.period_start;
  existing.period_end = base.period_end;
  existing.source = base.source;
  existing.confidence = base.confidence;
  existing.notes = base.notes;
  if (!String(existing.url ?? "").trim() && base.url) existing.url = base.url;
  if (JSON.stringify(existing) !== before) updated += 1;
}

documentSources.sort((a, b) =>
  normalizeCode(a.company_code).localeCompare(normalizeCode(b.company_code)) ||
  Number(a.meeting_year ?? 0) - Number(b.meeting_year ?? 0) ||
  String(a.document_type).localeCompare(String(b.document_type)) ||
  String(a.source_id).localeCompare(String(b.source_id))
);

await fs.writeFile(DOCUMENT_SOURCES_FILE, `${JSON.stringify(documentSources, null, 2)}\n`, "utf8");

console.log(`Merged EDINET annual report filings into document sources.`);
console.log(`Input filings: ${filings.length}`);
console.log(`Added: ${added}, updated: ${updated}`);
