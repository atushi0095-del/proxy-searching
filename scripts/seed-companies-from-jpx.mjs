/**
 * seed-companies-from-jpx.mjs
 *
 * JPX公式の上場企業一覧Excel（data_j.xls）をダウンロードし、
 * opposition_focus_companies.json にある実績データと突合して
 * companies.json / company_governance_metrics.json を一括補完する。
 *
 * 実行: node scripts/seed-companies-from-jpx.mjs
 * オプション:
 *   --limit=500   追加上限（デフォルト: 2000）
 *   --min-against=0  反対実績が N 件以上の企業のみ追加（デフォルト: 0）
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── CLI args ──────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k, v] = a.slice(2).split("="); return [k, v]; })
);
const LIMIT = Number(args["limit"] ?? 2000);
const MIN_AGAINST = Number(args["min-against"] ?? 0);

// ── Paths ────────────────────────────────────────────
const DATA_DIR = path.join(ROOT, "data");
const GEN_DIR = path.join(DATA_DIR, "generated");
const COMPANIES_FILE = path.join(DATA_DIR, "companies.json");
const GOV_FILE = path.join(DATA_DIR, "company_governance_metrics.json");
const FOCUS_FILE = path.join(GEN_DIR, "opposition_focus_companies.json");

// JPX 上場銘柄一覧Excel URL（毎日更新）
const JPX_URL = "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls";

// ── Helper: HTTP fetch to buffer ─────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function load(file) { return JSON.parse(readFileSync(file, "utf8")); }
function save(file, data) { writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8"); }

// ── Market & sector normalizers ───────────────────────
function normalizeMarket(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (s.includes("プライム")) return "東証プライム";
  if (s.includes("スタンダード")) return "東証スタンダード";
  if (s.includes("グロース")) return "東証グロース";
  if (s.includes("名証")) return "名証";
  if (s.includes("札証")) return "札証";
  if (s.includes("福証")) return "福証";
  return s;
}

// JPX 33業種コード → 業種名マッピング
const SECTOR_MAP = {
  "1050": "水産・農林業",
  "1100": "鉱業",
  "1200": "建設業",
  "2050": "食料品",
  "2100": "繊維製品",
  "2150": "パルプ・紙",
  "2200": "化学",
  "2250": "医薬品",
  "2300": "石油・石炭製品",
  "2350": "ゴム製品",
  "2400": "ガラス・土石製品",
  "2450": "鉄鋼",
  "2500": "非鉄金属",
  "2550": "金属製品",
  "3050": "機械",
  "3100": "電気機器",
  "3150": "輸送用機器",
  "3200": "精密機器",
  "3250": "その他製品",
  "3300": "電気・ガス業",
  "3350": "陸運業",
  "3400": "海運業",
  "3450": "空運業",
  "3500": "倉庫・運輸関連業",
  "3550": "情報・通信業",
  "3600": "卸売業",
  "3650": "小売業",
  "3700": "銀行業",
  "3750": "証券、商品先物取引業",
  "3800": "保険業",
  "3850": "その他金融業",
  "3900": "不動産業",
  "4050": "サービス業",
};

// ── Estimate governance metrics from sector/market defaults ──
function estimateGovMetrics(company_code, market) {
  // Defaults based on market segment
  const isPrime = market === "東証プライム";
  const isStandard = market === "東証スタンダード";

  const boardSize = isPrime ? 9 : isStandard ? 8 : 7;
  const outsideCount = isPrime ? 4 : 3;
  const indepCount = isPrime ? 4 : 3;
  const femaleCount = isPrime ? 2 : 1;
  const indepRatio = Math.round((indepCount / boardSize) * 1000) / 10;
  const femaleRatio = Math.round((femaleCount / boardSize) * 1000) / 10;

  return {
    company_code,
    meeting_year: 2025,
    board_size: boardSize,
    inside_director_count: boardSize - outsideCount,
    outside_director_count: outsideCount,
    independent_director_count: indepCount,
    female_director_count: femaleCount,
    female_director_ratio: femaleRatio,
    independent_director_ratio: indepRatio,
    has_independent_board_chair: false,
    has_nominating_committee: isPrime,
    has_compensation_committee: isPrime,
    policy_shareholdings_ratio: null,
    source_url: "",
    notes: "JPX上場企業一覧より自動生成。実際の数値はCG報告書・招集通知で確認のこと。",
  };
}

// ── Main ─────────────────────────────────────────────
console.log("📥 JPX 上場銘柄一覧をダウンロード中...");
const xlsBuf = await fetchBuffer(JPX_URL);
console.log(`   ${(xlsBuf.length / 1024).toFixed(0)} KB 取得`);

const wb = XLSX.read(xlsBuf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

console.log(`   ${rows.length} 行解析`);

// JPX Excel のヘッダーを確認
if (rows.length > 0) {
  console.log("   列名:", Object.keys(rows[0]).slice(0, 10).join(", "));
}

// JPX のカラム名を柔軟にマッピング
function pick(row, ...candidates) {
  for (const k of candidates) {
    if (row[k] !== undefined && row[k] !== "") return String(row[k]).trim();
  }
  return "";
}

const jpxMap = new Map(); // code → { company_name, market, sector, fiscal_year_end }
for (const row of rows) {
  const code = pick(row, "コード", "証券コード", "Code", "code");
  if (!code || !/^\d{4}$/.test(code)) continue;

  const name = pick(row, "銘柄名", "会社名", "Name", "name");
  const marketRaw = pick(row, "市場・商品区分", "市場区分", "Market", "market");
  const sectorCode = pick(row, "33業種コード", "業種コード");
  const sectorName = pick(row, "33業種区分", "業種区分", "Sector", "sector");
  const scaleCode = pick(row, "規模コード", "規模区分");
  const fiscalMonthRaw = pick(row, "決算月", "決算期");
  const fiscalMonth = fiscalMonthRaw ? String(fiscalMonthRaw).padStart(2, "0") : "";

  jpxMap.set(code, {
    company_name: name,
    market: normalizeMarket(marketRaw),
    sector: SECTOR_MAP[sectorCode] || sectorName || "",
    fiscal_year_end: fiscalMonth,
    scale_code: scaleCode,
  });
}

console.log(`✅ JPX: ${jpxMap.size} 社のマスターデータ取得完了`);

// ── Load existing data ────────────────────────────────
const existingCompanies = load(COMPANIES_FILE);
const existingGov = load(GOV_FILE);
const focusData = load(FOCUS_FILE);

const existingCodes = new Set(existingCompanies.map(c => c.company_code));
const existingGovCodes = new Set(existingGov.map(g => g.company_code));

// ── Build candidates from focus companies ─────────────
// focus.companies は against_count 降順でソート済み
const candidates = focusData.companies
  .filter(c => /^\d{4}$/.test(c.company_code))
  .filter(c => !existingCodes.has(c.company_code))
  .filter(c => (c.against_count ?? 0) >= MIN_AGAINST)
  .slice(0, LIMIT);

console.log(`\n📊 追加候補: ${candidates.length} 社（既存 ${existingCodes.size} 社を除く）`);

const newCompanies = [];
const newGovMetrics = [];
let jpxHit = 0;
let jpxMiss = 0;

for (const fc of candidates) {
  const code = fc.company_code;
  const jpx = jpxMap.get(code);

  if (jpx) {
    jpxHit++;
    newCompanies.push({
      company_code: code,
      company_name: jpx.company_name || fc.company_name,
      fiscal_year_end: jpx.fiscal_year_end || "03",
      market: jpx.market || "",
      sector: jpx.sector || "",
      source_url: "",
      topix_component: jpx.scale_code === "1", // TOPIX100 相当
    });
    if (!existingGovCodes.has(code)) {
      newGovMetrics.push(estimateGovMetrics(code, jpx.market));
    }
  } else {
    jpxMiss++;
    // 非上場・コード変更等。会社名のみで登録
    newCompanies.push({
      company_code: code,
      company_name: fc.company_name,
      fiscal_year_end: "03",
      market: "",
      sector: "",
      source_url: "",
    });
    if (!existingGovCodes.has(code)) {
      newGovMetrics.push(estimateGovMetrics(code, ""));
    }
  }
}

console.log(`   JPX一覧マッチ: ${jpxHit} 社, 未マッチ(上場廃止等): ${jpxMiss} 社`);

// ── Merge & sort ──────────────────────────────────────
const mergedCompanies = [...existingCompanies, ...newCompanies]
  .sort((a, b) => a.company_code.localeCompare(b.company_code));

const mergedGov = [...existingGov, ...newGovMetrics]
  .sort((a, b) => a.company_code.localeCompare(b.company_code));

save(COMPANIES_FILE, mergedCompanies);
save(GOV_FILE, mergedGov);

console.log(`\n✅ companies.json: ${mergedCompanies.length} 社（+${newCompanies.length}）`);
console.log(`✅ company_governance_metrics.json: ${mergedGov.length} 社（+${newGovMetrics.length}）`);
console.log("\n次のステップ:");
console.log("  node scripts/seed-directors-all-companies.mjs");
