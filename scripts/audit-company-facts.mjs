import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUT_FILE = path.join(GENERATED_DIR, "company_fact_coverage.json");

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));
}

function asCode(value) {
  return String(value ?? "").trim();
}

function groupCountByCode(rows) {
  const counts = new Map();
  for (const row of rows) {
    const code = asCode(row.company_code);
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

function groupYearsByCode(rows, yearKey) {
  const years = new Map();
  for (const row of rows) {
    const code = asCode(row.company_code);
    const year = row[yearKey];
    if (!code || year == null) continue;
    const arr = years.get(code) ?? [];
    arr.push(Number(year));
    years.set(code, arr);
  }
  return years;
}

function documentCoverage(rows) {
  const docs = new Map();
  for (const row of rows) {
    const code = asCode(row.company_code);
    if (!code) continue;
    const entry = docs.get(code) ?? {
      annual_securities_report: 0,
      notice_of_meeting: 0,
      corporate_governance_report: 0,
      company_vote_result: 0,
      with_url: 0,
    };
    const type = row.document_type;
    if (type && Object.prototype.hasOwnProperty.call(entry, type)) entry[type] += 1;
    if (String(row.url ?? "").trim()) entry.with_url += 1;
    docs.set(code, entry);
  }
  return docs;
}

function priorityScore({ financialCount, directorCount, governanceCount, documentInfo }) {
  let score = 0;
  if (financialCount === 0) score += 4;
  if (directorCount === 0) score += 5;
  if (governanceCount === 0) score += 4;
  if ((documentInfo?.with_url ?? 0) === 0) score += 2;
  return score;
}

const companies = await readJson("data/companies.json");
const financialMetrics = await readJson("data/financial_metrics.json");
const directors = await readJson("data/directors.json");
const governanceMetrics = await readJson("data/company_governance_metrics.json");
const documentSources = await readJson("data/document_sources.json");

const financialCounts = groupCountByCode(financialMetrics);
const directorCounts = groupCountByCode(directors);
const governanceCounts = groupCountByCode(governanceMetrics);
const financialYears = groupYearsByCode(financialMetrics, "fiscal_year");
const directorYears = groupYearsByCode(directors, "meeting_year");
const governanceYears = groupYearsByCode(governanceMetrics, "meeting_year");
const docsByCode = documentCoverage(documentSources);

const rows = companies.map((company) => {
  const code = asCode(company.company_code);
  const documentInfo = docsByCode.get(code) ?? {
    annual_securities_report: 0,
    convocation_notice: 0,
    corporate_governance_report: 0,
    company_vote_result: 0,
    with_url: 0,
  };
  const financialCount = financialCounts.get(code) ?? 0;
  const directorCount = directorCounts.get(code) ?? 0;
  const governanceCount = governanceCounts.get(code) ?? 0;
  const missing = [];
  if (financialCount === 0) missing.push("financial_metrics");
  if (directorCount === 0) missing.push("directors");
  if (governanceCount === 0) missing.push("governance_metrics");
  if (documentInfo.with_url === 0) missing.push("evidence_urls");
  return {
    company_code: code,
    company_name: company.company_name,
    market: company.market,
    sector: company.sector,
    financial_metric_count: financialCount,
    financial_years: [...new Set(financialYears.get(code) ?? [])].sort((a, b) => a - b),
    director_count: directorCount,
    director_years: [...new Set(directorYears.get(code) ?? [])].sort((a, b) => a - b),
    governance_metric_count: governanceCount,
    governance_years: [...new Set(governanceYears.get(code) ?? [])].sort((a, b) => a - b),
    documents: documentInfo,
    missing,
    priority_score: priorityScore({ financialCount, directorCount, governanceCount, documentInfo }),
  };
});

rows.sort((a, b) => b.priority_score - a.priority_score || a.company_code.localeCompare(b.company_code));

const summary = {
  generated_at: new Date().toISOString(),
  company_count: companies.length,
  with_financial_metrics: rows.filter((row) => row.financial_metric_count > 0).length,
  with_directors: rows.filter((row) => row.director_count > 0).length,
  with_governance_metrics: rows.filter((row) => row.governance_metric_count > 0).length,
  with_any_evidence_url: rows.filter((row) => row.documents.with_url > 0).length,
  high_priority_missing: rows.filter((row) => row.priority_score >= 10).length,
};

await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.writeFile(OUT_FILE, `${JSON.stringify({ summary, rows }, null, 2)}\n`, "utf8");

console.log("Company fact coverage");
console.log(JSON.stringify(summary, null, 2));
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
