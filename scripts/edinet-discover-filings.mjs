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

const limit = Number(args.get("limit") ?? 9999);
const delay = Number(args.get("delay") ?? 2000);
// --merge: 既存 edinet_filings.json に追記・重複排除（デフォルト true）
const doMerge = args.get("merge") !== "false";

const companies = JSON.parse(await fs.readFile(COMPANIES_FILE, "utf8"));
const secCodeMap = targetSecCodes(companies, args.get("company"));

// 既存ファイルを読み込み（マージ用）
let existingFilings = [];
if (doMerge) {
  try {
    const existing = JSON.parse(await fs.readFile(OUTPUT_FILE, "utf8"));
    existingFilings = Array.isArray(existing.filings) ? existing.filings : [];
    console.log(`既存 edinet_filings.json: ${existingFilings.length} 件を読み込み（マージモード）`);
  } catch { /* ファイルなし = 初回 */ }
}
const existingDocIds = new Set(existingFilings.map(f => f.doc_id));

const newFilings = [];
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
    const secCode = String(doc.secCode ?? "");
    const company = secCodeMap.get(secCode);
    if (!company) continue;
    if (String(doc.docTypeCode ?? "") !== "120") continue; // 有価証券報告書のみ
    const docId = doc.docID ?? "";
    if (existingDocIds.has(docId)) continue; // 重複スキップ
    newFilings.push({
      company_code: company.company_code,
      company_name: company.company_name,
      edinet_code: doc.edinetCode ?? "",
      sec_code: secCode,
      doc_id: docId,
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
    if (newFilings.length >= limit) break;
  }
  if (newFilings.length >= limit) break;

  process.stdout.write(`\r  ${date} | 新規: ${newFilings.length} 件 (API: ${apiCalls}回)   `);
  await sleep(delay);
}

// マージして period_end でソート
const mergedFilings = [...existingFilings, ...newFilings]
  .sort((a, b) => (b.period_end ?? "").localeCompare(a.period_end ?? ""));

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(
  OUTPUT_FILE,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      api: "EDINET API v2",
      request: { from, to, company: args.get("company") ?? null, limit, delay },
      total: mergedFilings.length,
      new_this_run: newFilings.length,
      filings: mergedFilings,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`\n✅ edinet_filings.json: 合計 ${mergedFilings.length} 件（今回追加: ${newFilings.length} 件）`);
