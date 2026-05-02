/**
 * fetch-financial-metrics-jquants.mjs
 *
 * J-Quants v2 API（公式JPXデータ）から全企業の財務データを取得し
 * data/financial_metrics.json を補完する。
 *
 * 実行:
 *   node scripts/fetch-financial-metrics-jquants.mjs
 *   node scripts/fetch-financial-metrics-jquants.mjs --limit=500
 *   node scripts/fetch-financial-metrics-jquants.mjs --force   # 既存も上書き
 */

import { readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── CLI args ──────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "true"]; })
);
const LIMIT      = Number(args.limit ?? 9999);
const FORCE      = args.force === "true";
const CONCURRENCY = Math.min(Number(args.concurrency ?? 1), 2);
const DELAY_MS   = Number(args.delay ?? 13000); // 無料プラン: 5req/min → 12秒/req。13秒に設定して余裕を持たせる

// ── API Key ───────────────────────────────────────────
const API_KEY = process.env.JQUANTS_API_KEY ?? "-3CdGox44qXQMLoIhNkdGflx6XH4P7bNkANWbSDRB5U";

// ── Files ─────────────────────────────────────────────
const COMPANIES_FILE = path.join(ROOT, "data", "companies.json");
const FIN_FILE       = path.join(ROOT, "data", "financial_metrics.json");

function load(f) { return JSON.parse(readFileSync(f, "utf8")); }
function save(f, d) { writeFileSync(f, JSON.stringify(d, null, 2) + "\n", "utf8"); }

// ── HTTP helper ───────────────────────────────────────
function getJson(path) {
  return new Promise((res, rej) => {
    https.get({ hostname: "api.jquants.com", path,
      headers: { "x-api-key": API_KEY }
    }, r => {
      let d = "";
      r.on("data", c => d += c);
      r.on("end", () => {
        try { res({ status: r.statusCode, body: JSON.parse(d) }); }
        catch { res({ status: r.statusCode, body: { raw: d.slice(0, 200) } }); }
      });
    }).on("error", rej);
  });
}

// ── Financial data extractor ──────────────────────────
async function fetchMetrics(companyCode) {
  const { status, body } = await getJson(`/v2/fins/summary?code=${companyCode}`);

  if (status === 429) {
    // 日次上限または分間上限超過
    const msg = body?.message ?? "";
    throw new Error(msg.toLowerCase().includes("day") ? "DAILY_LIMIT" : "RATE_LIMIT");
  }
  if (status === 403 || status === 404) return null;
  if (status !== 200) return null;
  if (!body.data || body.data.length === 0) return null;

  const records = body.data;

  // 直近の通期実績を取得（Forecast 以外で DocType に FY を含む）
  const annuals = records
    .filter(r => r.CurPerType === "FY" && !r.DocType?.includes("Forecast"))
    .sort((a, b) => b.CurPerEn?.localeCompare(a.CurPerEn ?? "") ?? 0);

  const rec = annuals[0];
  if (!rec) return null;

  const np  = Number(rec.NP  ?? 0); // 純利益（円）
  const eq  = Number(rec.Eq  ?? 0); // 自己資本（円）
  const ta  = Number(rec.TA  ?? 0); // 総資産（円）
  const eps = Number(rec.EPS ?? 0);
  const bps = Number(rec.BPS ?? 0);
  const sales = Number(rec.Sales ?? 0);
  const op    = Number(rec.OP  ?? 0);
  const eqar  = Number(rec.EqAR ?? 0); // 自己資本比率

  if (eq === 0) return null; // 計算不能

  const roe = Math.round((np / eq) * 10000) / 100; // %（小数2桁）

  // 決算年度（通期終了月の年）
  const fiscalYear = rec.CurPerEn
    ? Number(rec.CurPerEn.slice(0, 4))
    : new Date().getFullYear();

  return {
    roe,
    pbr: null,       // 株価データが無料プランでは非対応
    net_income:            Math.round(np / 1_000_000),  // 百万円
    shareholders_equity:   Math.round(eq / 1_000_000),  // 百万円
    total_assets:          Math.round(ta / 1_000_000),  // 百万円
    sales:                 Math.round(sales / 1_000_000),
    operating_profit:      Math.round(op / 1_000_000),
    eps: Math.round(eps * 100) / 100,
    bps: Math.round(bps * 100) / 100,
    equity_ratio: Math.round(eqar * 10000) / 100,      // %
    fiscal_year: fiscalYear,
    fiscal_period_end: rec.CurPerEn ?? "",
    source_url: `https://api.jquants.com/v2/fins/summary?code=${companyCode}`,
    notes: `J-Quants v2 自動取得（${new Date().toISOString().slice(0, 10)}）。連結決算ベース。`,
  };
}

// ── Merge helper ──────────────────────────────────────
function mergeMetrics(base, additions) {
  const map = new Map();
  for (const e of base) map.set(`${e.company_code}_${e.fiscal_year}`, e);
  for (const e of additions) map.set(`${e.company_code}_${e.fiscal_year}`, e);
  return [...map.values()].sort((a, b) =>
    a.company_code.localeCompare(b.company_code) || (a.fiscal_year - b.fiscal_year));
}

// ── Main ─────────────────────────────────────────────
const companies  = load(COMPANIES_FILE);
const existing   = load(FIN_FILE);
const existingCodes = new Set(existing.map(e => e.company_code));

const targets = companies
  .filter(c => FORCE || !existingCodes.has(c.company_code))
  .slice(0, LIMIT);

if (targets.length === 0) {
  console.log("✅ 全企業の財務データ取得済み（--force で再取得）");
  process.exit(0);
}

console.log(`\n📊 J-Quants v2 財務データ取得開始`);
console.log(`   対象: ${targets.length} 社（並列 ${CONCURRENCY}、間隔 ${DELAY_MS}ms）`);
console.log(`   既存: ${existingCodes.size} 社 → 合計 ${companies.length} 社\n`);

const newEntries = [];
let done = 0, success = 0, noData = 0, errors = 0;
let dailyLimitHit = false;

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  if (dailyLimitHit) break;

  const chunk = targets.slice(i, i + CONCURRENCY);

  const results = await Promise.all(chunk.map(async (company) => {
    let retries = 2;
    while (retries >= 0) {
      try {
        const m = await fetchMetrics(company.company_code);
        return { company_code: company.company_code, metrics: m };
      } catch (err) {
        if (err.message === "DAILY_LIMIT") {
          dailyLimitHit = true;
          return { company_code: company.company_code, error: "DAILY_LIMIT" };
        }
        if (err.message === "RATE_LIMIT" && retries > 0) {
          await new Promise(r => setTimeout(r, 20000)); // 429時は20秒待機してリトライ
          retries--;
          continue;
        }
        return { company_code: company.company_code, error: err.message };
      }
    }
  }));

  for (const r of results) {
    done++;
    if (r.error) {
      errors++;
    } else if (!r.metrics) {
      noData++;
    } else {
      success++;
      newEntries.push({
        company_code: r.company_code,
        fiscal_year:  r.metrics.fiscal_year,
        roe:          r.metrics.roe,
        pbr:          r.metrics.pbr,
        tsr_3y_rank_percentile: null,
        net_income:   r.metrics.net_income,
        shareholders_equity: r.metrics.shareholders_equity,
        total_assets: r.metrics.total_assets,
        sales:        r.metrics.sales,
        operating_profit: r.metrics.operating_profit,
        eps:          r.metrics.eps,
        bps:          r.metrics.bps,
        equity_ratio: r.metrics.equity_ratio,
        fiscal_period_end: r.metrics.fiscal_period_end,
        source_url:   r.metrics.source_url,
        notes:        r.metrics.notes,
      });
    }
  }

  // 進捗表示
  const pct = Math.round(done / targets.length * 100);
  process.stdout.write(
    `\r  [${pct}%] ${done}/${targets.length} 社 ✅${success} ⬜${noData} ❌${errors}   `
  );

  // 50社ごとに中間保存
  if (newEntries.length > 0 && done % 50 < CONCURRENCY) {
    const merged = mergeMetrics(existing, newEntries);
    save(FIN_FILE, merged);
  }

  if (i + CONCURRENCY < targets.length) {
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
}

// 最終保存
const finalData = mergeMetrics(existing, newEntries);
save(FIN_FILE, finalData);

console.log(`\n\n✅ 取得完了！`);
if (dailyLimitHit) {
  console.log(`\n⚠️  J-Quants 日次レートリミット（無料プラン上限）に達しました。`);
  console.log(`   明日また実行してください: node scripts/fetch-financial-metrics-jquants.mjs`);
  const remaining = targets.length - done;
  console.log(`   残り: ${remaining} 社（全 ${targets.length} 社中 ${done} 社処理済み）`);
}
console.log(`   成功: ${success} 社`);
console.log(`   データなし（非上場等）: ${noData} 社`);
console.log(`   エラー: ${errors} 社`);
console.log(`\n✅ financial_metrics.json: ${finalData.length} 件（+${newEntries.length}）`);
if (!dailyLimitHit) {
  console.log(`\n次のステップ:`);
  console.log(`   npm run build   ← スクリーナーに反映`);
}
