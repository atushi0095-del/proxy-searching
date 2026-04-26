import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const COMPANIES_FILE = path.join(ROOT, "data", "companies.json");
const OUTPUT_FILE = path.join(ROOT, "data", "generated", "edinet_filings.json");
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
  EDINET_API_KEY=... npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --company=7203 --limit=3

Options:
  --from=YYYY-MM-DD     Required
  --to=YYYY-MM-DD       Required
  --company=7203        Optional. If omitted, all companies in data/companies.json are targeted.
  --limit=10            Optional. Max filing records to save.
  --delay=2000          Optional. Delay per API request in ms.
`);
}

function assertApiKey() {
  if (!API_KEY) {
    usage();
    throw new Error("EDINET_API_KEY is not set. Register for an EDINET API key and set it as an environment variable.");
  }
}

function dateRange(from, to) {
  const dates = [];
  const current = new Date(`${from}T00:00:00+09:00`);
  const end = new Date(`${to}T00:00:00+09:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime()) || current > end) {
    throw new Error("Invalid --from/--to date range.");
  }
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function targetSecCodes(companies, companyArg) {
  const selected = companyArg
    ? companies.filter((company) => String(company.company_code) === String(companyArg))
    : companies;
  return new Map(selected.map((company) => [`${company.company_code}0`, company]));
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

assertApiKey();

const from = args.get("from");
const to = args.get("to");
if (!from || !to) {
  usage();
  throw new Error("--from and --to are required.");
}

const limit = Number(args.get("limit") ?? 10);
const delay = Number(args.get("delay") ?? 2000);
const companies = JSON.parse(await fs.readFile(COMPANIES_FILE, "utf8"));
const secCodeMap = targetSecCodes(companies, args.get("company"));
const filings = [];

for (const date of dateRange(from, to)) {
  const payload = await fetchDocumentList(date);
  const results = Array.isArray(payload.results) ? payload.results : [];
  for (const doc of results) {
    const secCode = String(doc.secCode ?? "");
    const company = secCodeMap.get(secCode);
    if (!company) continue;
    if (String(doc.docTypeCode ?? "") !== "120") continue; // 有価証券報告書
    filings.push({
      company_code: company.company_code,
      company_name: company.company_name,
      edinet_code: doc.edinetCode ?? "",
      sec_code: secCode,
      doc_id: doc.docID ?? "",
      doc_type_code: doc.docTypeCode ?? "",
      form_code: doc.formCode ?? "",
      submit_date_time: doc.submitDateTime ?? "",
      period_start: doc.periodStart ?? "",
      period_end: doc.periodEnd ?? "",
      filer_name: doc.filerName ?? "",
      ordinance_code: doc.ordinanceCode ?? "",
      source: "EDINET API v2 documents.json",
      discovered_at: new Date().toISOString(),
    });
    if (filings.length >= limit) break;
  }
  if (filings.length >= limit) break;
  await sleep(delay);
}

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(
  OUTPUT_FILE,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      api: "EDINET API v2",
      request: { from, to, company: args.get("company") ?? null, limit, delay },
      total: filings.length,
      filings,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)} with ${filings.length} filings`);
