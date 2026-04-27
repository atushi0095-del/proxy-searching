import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const COMPANIES_FILE = path.join(ROOT, "data", "companies.json");
const DOCUMENT_SOURCES_FILE = path.join(ROOT, "data", "document_sources.json");
const TARGET_LIMIT = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 20);
const TARGET_OFFSET = Number(process.argv.find((arg) => arg.startsWith("--offset="))?.split("=")[1] ?? 0);

const PRIORITY_CODES = [
  "1930", "1972", "2445", "3178", "3769",
  "3865", "4319", "4343", "4620", "4676",
  "4746", "4801", "5449", "5830", "5909",
  "5946", "6098", "6284", "6902", "7211",
];

const SOURCE_TYPES = [
  "ir_top",
  "annual_securities_report",
  "notice_of_meeting",
  "corporate_governance_report",
];

function normalizeUrl(url) {
  const value = String(url ?? "").trim();
  return value || "";
}

function sourceId(code, type) {
  return `DOC_${code}_2025_${type.toUpperCase()}`;
}

function makeSource(company, type) {
  const code = String(company.company_code);
  const url = normalizeUrl(company.source_url);
  const common = {
    company_code: code,
    meeting_year: 2025,
    filing_date: "",
  };
  if (type === "ir_top") {
    return {
      source_id: sourceId(code, "ir_top"),
      ...common,
      document_type: "ir_top",
      document_label: "公式IR入口",
      title: `${company.company_name} 公式IR・企業情報`,
      url,
      notes: "企業FACT確認の起点。招集通知、有価証券報告書、決算資料、CG報告書への導線を確認するための公式ページ。",
    };
  }
  if (type === "annual_securities_report") {
    return {
      source_id: sourceId(code, "annual_securities_report"),
      ...common,
      document_type: "annual_securities_report",
      document_label: "有価証券報告書確認入口",
      title: `${company.company_name} 有価証券報告書確認入口`,
      url,
      notes: "ROE、PBR、政策保有株式、役員情報、ガバナンス情報の抽出候補。正式なdoc_idはEDINET APIバックフィルで補完する。",
    };
  }
  if (type === "notice_of_meeting") {
    return {
      source_id: sourceId(code, "notice_of_meeting"),
      ...common,
      document_type: "notice_of_meeting",
      document_label: "招集通知確認入口",
      title: `${company.company_name} 招集通知確認入口`,
      url,
      notes: "候補者番号、候補者氏名、役職、社外・独立性、在任年数、出席率、議案番号の抽出候補。",
    };
  }
  return {
    source_id: sourceId(code, "corporate_governance_report"),
    ...common,
    document_type: "corporate_governance_report",
    document_label: "CG報告書確認入口",
    title: `${company.company_name} コーポレートガバナンス報告書確認入口`,
    url,
    notes: "取締役会構成、独立社外取締役比率、女性取締役、委員会設置、政策保有株式方針の確認候補。",
  };
}

const companies = JSON.parse(await fs.readFile(COMPANIES_FILE, "utf8"));
const documentSources = JSON.parse(await fs.readFile(DOCUMENT_SOURCES_FILE, "utf8"));
const byId = new Map(documentSources.map((source) => [source.source_id, source]));
const companyByCode = new Map(companies.map((company) => [String(company.company_code), company]));

function hasMissingEvidence(company) {
  const code = String(company.company_code);
  return SOURCE_TYPES.some((type) => {
    const source = byId.get(sourceId(code, type));
    return !source || !normalizeUrl(source.url);
  });
}

const prioritySet = new Set(PRIORITY_CODES);
const candidates = [
  ...PRIORITY_CODES.map((code) => companyByCode.get(code)).filter(Boolean),
  ...companies
    .filter((company) => !prioritySet.has(String(company.company_code)))
    .filter((company) => normalizeUrl(company.source_url))
    .sort((a, b) => String(a.company_code).localeCompare(String(b.company_code))),
].filter(hasMissingEvidence);

const selected = candidates.slice(TARGET_OFFSET, TARGET_OFFSET + TARGET_LIMIT);

let added = 0;
let updated = 0;

for (const company of selected) {
  for (const type of SOURCE_TYPES) {
    const next = makeSource(company, type);
    const existing = byId.get(next.source_id);
    if (!existing) {
      documentSources.push(next);
      byId.set(next.source_id, next);
      added += 1;
      continue;
    }
    if (!normalizeUrl(existing.url) && normalizeUrl(next.url)) {
      existing.url = next.url;
      existing.notes = `${existing.notes || ""} 公式入口URLを補完。`.trim();
      updated += 1;
    }
  }
}

documentSources.sort((a, b) =>
  String(a.company_code).localeCompare(String(b.company_code)) ||
  String(a.document_type).localeCompare(String(b.document_type)) ||
  String(a.source_id).localeCompare(String(b.source_id))
);

await fs.writeFile(DOCUMENT_SOURCES_FILE, `${JSON.stringify(documentSources, null, 2)}\n`, "utf8");

console.log(`Seeded company evidence links for ${selected.length} companies`);
console.log(`Candidate companies needing evidence: ${candidates.length}`);
console.log(`Offset: ${TARGET_OFFSET}, limit: ${TARGET_LIMIT}`);
console.log(`Added: ${added}, updated: ${updated}`);
