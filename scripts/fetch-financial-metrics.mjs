/**
 * fetch-financial-metrics.mjs
 *
 * Yahoo Finance から全企業の ROE・PBR・純利益・自己資本を取得し
 * data/financial_metrics.json を補完する。
 *
 * 実行例:
 *   node scripts/fetch-financial-metrics.mjs              # 全社（スキップあり）
 *   node scripts/fetch-financial-metrics.mjs --limit=200  # 最大200社ずつ
 *   node scripts/fetch-financial-metrics.mjs --force      # 既存データ上書き
 *   node scripts/fetch-financial-metrics.mjs --concurrency=3  # 並列数
 *
 * Yahoo Finance 利用条件: 個人・非商用利用に限定。
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── CLI args ──────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "true"]; })
);
const LIMIT = Number(args.limit ?? 9999);
const FORCE = args.force === "true";
const CONCURRENCY = Math.min(Number(args.concurrency ?? 3), 5); // max 5 並列
const DELAY_MS = Number(args.delay ?? 800); // リクエスト間隔（ms）

// ── Files ─────────────────────────────────────────────
const COMPANIES_FILE = path.join(ROOT, "data", "companies.json");
const FIN_FILE = path.join(ROOT, "data", "financial_metrics.json");

function load(f) { return JSON.parse(readFileSync(f, "utf8")); }
function save(f, d) { writeFileSync(f, JSON.stringify(d, null, 2) + "\n", "utf8"); }

// ── Yahoo Finance client ──────────────────────────────
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchMetrics(companyCode) {
  const symbol = `${companyCode}.T`;
  try {
    const res = await yf.quoteSummary(symbol, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail"],
    });

    const fd = res?.financialData ?? {};
    const ks = res?.defaultKeyStatistics ?? {};
    const sd = res?.summaryDetail ?? {};

    const roeRaw = fd.returnOnEquity;            // decimal (e.g. 0.124)
    const pbrRaw = ks.priceToBook ?? sd.priceToBook;
    const netIncomeRaw = fd.netIncomeToCommon;   // absolute value (JPY)
    const equityRaw = fd.totalStockholdersEquity ?? null; // might not be present

    const roe = roeRaw != null ? Math.round(roeRaw * 10000) / 100 : null; // → %
    const pbr = pbrRaw != null ? Math.round(pbrRaw * 100) / 100 : null;
    const netIncome = netIncomeRaw != null ? Math.round(netIncomeRaw / 1_000_000) : null; // → 百万円
    const equity = equityRaw != null ? Math.round(equityRaw / 1_000_000) : null;

    return { roe, pbr, net_income: netIncome, shareholders_equity: equity, symbol };
  } catch (err) {
    const msg = err?.message ?? String(err);
    if (
      msg.includes("No fundamentals data") || msg.includes("Not Found") ||
      msg.includes("404") || msg.includes("Quote not found") ||
      msg.includes("No data found") || msg.includes("HTTPError") ||
      msg.includes("Will be delisted")
    ) {
      return null; // 上場廃止・コード変更等
    }
    throw err;
  }
}

// ── Main ─────────────────────────────────────────────
const companies = load(COMPANIES_FILE);
const existing = load(FIN_FILE);

// 既存データを company_code → entries[] のマップに
const existingMap = new Map();
for (const entry of existing) {
  const list = existingMap.get(entry.company_code) ?? [];
  list.push(entry);
  existingMap.set(entry.company_code, list);
}

// 対象企業: FORCE なら全社、そうでなければ未取得企業のみ
const targets = companies
  .filter(c => FORCE || !existingMap.has(c.company_code))
  .slice(0, LIMIT);

if (targets.length === 0) {
  console.log("✅ 全企業の金融データ取得済み。--force で再取得できます。");
  process.exit(0);
}

console.log(`📊 取得対象: ${targets.length} 社（並列数 ${CONCURRENCY}、間隔 ${DELAY_MS}ms）`);
console.log(`   既存データ: ${existingMap.size} 社 → 合計 ${companies.length} 社`);

const newEntries = [];
let done = 0;
let success = 0;
let notFound = 0;
let errors = 0;

// 並列処理ヘルパー
async function processChunk(chunk) {
  const results = await Promise.all(chunk.map(async (company) => {
    try {
      const metrics = await fetchMetrics(company.company_code);
      if (metrics === null) {
        return { company_code: company.company_code, status: "not_found" };
      }
      return {
        company_code: company.company_code,
        company_name: company.company_name,
        status: "ok",
        metrics,
      };
    } catch (err) {
      return {
        company_code: company.company_code,
        status: "error",
        error: err?.message ?? String(err),
      };
    }
  }));
  return results;
}

const FISCAL_YEAR = new Date().getFullYear(); // 直近年度として登録

// チャンクに分けて処理
for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const chunk = targets.slice(i, i + CONCURRENCY);
  const results = await processChunk(chunk);

  for (const r of results) {
    done++;
    if (r.status === "ok" && r.metrics.roe !== null) {
      success++;
      newEntries.push({
        company_code: r.company_code,
        fiscal_year: FISCAL_YEAR,
        roe: r.metrics.roe,
        pbr: r.metrics.pbr,
        tsr_3y_rank_percentile: null,
        net_income: r.metrics.net_income,
        shareholders_equity: r.metrics.shareholders_equity,
        source_url: `https://finance.yahoo.com/quote/${r.metrics.symbol}`,
        notes: `Yahoo Finance 自動取得（${new Date().toISOString().slice(0, 10)}）。ROE は直近TTMベース。`,
      });
      if (done % 10 === 0 || done === targets.length) {
        process.stdout.write(`\r   進捗: ${done}/${targets.length} 社（成功:${success} 未上場:${notFound} エラー:${errors}）   `);
      }
    } else if (r.status === "not_found") {
      notFound++;
    } else if (r.status === "error") {
      errors++;
      if (errors <= 5) console.warn(`\n   ⚠ ${r.company_code}: ${r.error}`);
    } else {
      // ROE null (取得できたがROEなし)
      notFound++;
    }
  }

  // 途中保存（50社ごと）
  if (newEntries.length > 0 && (i + CONCURRENCY) % 50 < CONCURRENCY) {
    const merged = mergeEntries(existing, newEntries);
    save(FIN_FILE, merged);
  }

  // リクエスト間隔
  if (i + CONCURRENCY < targets.length) {
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
}

console.log(`\n\n✅ 取得完了`);
console.log(`   成功: ${success} 社 / 未上場・ROEなし: ${notFound} 社 / エラー: ${errors} 社`);

// マージして保存
function mergeEntries(base, additions) {
  const map = new Map();
  // 既存データを年度ごとに保持
  for (const e of base) {
    const key = `${e.company_code}_${e.fiscal_year}`;
    map.set(key, e);
  }
  // 新規データで上書き（同一年度があれば）
  for (const e of additions) {
    const key = `${e.company_code}_${e.fiscal_year}`;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => a.company_code.localeCompare(b.company_code) || a.fiscal_year - b.fiscal_year);
}

const finalData = mergeEntries(existing, newEntries);
save(FIN_FILE, finalData);
console.log(`✅ financial_metrics.json: ${finalData.length} 件（+${newEntries.length}）`);
