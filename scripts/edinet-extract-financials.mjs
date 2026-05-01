/**
 * edinet-extract-financials.mjs
 *
 * EDINET の有価証券報告書（iXBRL / 従来型XBRL）から財務指標を抽出して
 * data/financial_metrics.json を更新する。
 *
 * 前提:
 *   1. EDINET_API_KEY が環境変数として設定されていること
 *   2. data/generated/edinet_filings.json が存在すること (edinet:discover 実行後)
 *
 * 実行:
 *   EDINET_API_KEY=xxx node scripts/edinet-extract-financials.mjs
 *   EDINET_API_KEY=xxx node scripts/edinet-extract-financials.mjs --limit=100
 *   EDINET_API_KEY=xxx node scripts/edinet-extract-financials.mjs --force   # キャッシュ無視
 */

import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const ROOT = process.cwd();
const FILINGS_FILE  = path.join(ROOT, "data", "generated", "edinet_filings.json");
const METRICS_FILE  = path.join(ROOT, "data", "financial_metrics.json");
const CACHE_DIR     = path.join(ROOT, "data", "generated", "sources", "edinet_xbrl_cache");
const API_BASE      = "https://api.edinet-fsa.go.jp/api/v2";
const API_KEY       = process.env.EDINET_API_KEY;

// ── CLI args ──────────────────────────────────────────
const args = new Map(
  process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=") || "true"];
  })
);
const LIMIT    = Number(args.get("limit") ?? 9999);
const DELAY_MS = Number(args.get("delay") ?? 2000);
const FORCE    = args.get("force") === "true";

if (!API_KEY) {
  console.error("❌ EDINET_API_KEY が設定されていません。");
  console.error("   EDINET_API_KEY=xxx node scripts/edinet-extract-financials.mjs");
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── ZIP reader (Node.js 組み込みのみ) ────────────────
/**
 * ZIP バッファから全エントリを展開して返す。
 * deflate 圧縮 (method=8) と 無圧縮 (method=0) に対応。
 */
function unzipEntries(buffer) {
  const entries = [];

  // EOCD (End of Central Directory) を末尾からサーチ
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return entries;

  const cdOffset   = buffer.readUInt32LE(eocdOffset + 16);
  const numEntries = buffer.readUInt16LE(eocdOffset + 8);

  let pos = cdOffset;
  for (let i = 0; i < numEntries && pos + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break; // Central directory entry

    const method      = buffer.readUInt16LE(pos + 10);
    const compSize    = buffer.readUInt32LE(pos + 20);
    const nameLen     = buffer.readUInt16LE(pos + 28);
    const extraLen    = buffer.readUInt16LE(pos + 30);
    const commentLen  = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name        = buffer.slice(pos + 46, pos + 46 + nameLen).toString("utf8");
    pos += 46 + nameLen + extraLen + commentLen;

    // Local file header でデータ開始位置を取得
    const localNameLen  = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart     = localOffset + 30 + localNameLen + localExtraLen;
    const compData      = buffer.slice(dataStart, dataStart + compSize);

    try {
      const data = method === 0 ? compData : inflateRawSync(compData);
      entries.push({ name, data });
    } catch {
      // 展開失敗はスキップ
    }
  }
  return entries;
}

// ── XBRL 値の取得 ─────────────────────────────────────
/**
 * iXBRL (inline XBRL) から概念名に対応する値を取得する。
 * 連結コンテキスト優先。
 */
function extractIxbrlValue(html, conceptNames) {
  for (const concept of conceptNames) {
    // <ix:nonFraction name="..." contextRef="..." scale="..." ...>値</ix:nonFraction>
    const re = new RegExp(
      `<ix:nonFraction[^>]+name="${escapeRe(concept)}"([^>]*)>([\\s\\S]*?)<\\/ix:nonFraction>`,
      "gi"
    );
    const matches = [...html.matchAll(re)];
    if (!matches.length) continue;

    // 連結コンテキスト優先
    for (const isConsolidated of [true, false]) {
      for (const m of matches) {
        const attrs = m[1];
        const raw   = m[2];
        const ctx   = (attrs.match(/contextRef="([^"]+)"/) || [])[1] ?? "";
        if (isConsolidated && /NonConsolidated/i.test(ctx)) continue;

        const scale = (attrs.match(/scale="([^"]+)"/) || [])[1] ?? null;
        const val   = parseXbrlNum(raw, scale);
        if (val !== null) return val;
      }
    }
  }
  return null;
}

/**
 * 従来型 XBRL (.xbrl) から概念名に対応する値を取得する。
 * 例: <jppfs_cor:NetSales contextRef="..." unitRef="JPY" ...>450000000000</jppfs_cor:NetSales>
 */
function extractTraditionalXbrlValue(xbrl, conceptNames) {
  for (const concept of conceptNames) {
    // namespace:LocalName 形式
    const local = concept.includes(":") ? concept.split(":")[1] : concept;
    // NamespacePrefix の後の部分が一致するタグを探す
    const re = new RegExp(
      `<[a-zA-Z_][a-zA-Z0-9_-]*:${escapeRe(local)}([^>]*)>([\\s\\S]*?)<\\/[a-zA-Z_][a-zA-Z0-9_-]*:${escapeRe(local)}>`,
      "gi"
    );
    const matches = [...xbrl.matchAll(re)];
    if (!matches.length) continue;

    for (const isConsolidated of [true, false]) {
      for (const m of matches) {
        const attrs = m[1];
        const raw   = m[2];
        const ctx   = (attrs.match(/contextRef="([^"]+)"/) || [])[1] ?? "";
        if (isConsolidated && /NonConsolidated/i.test(ctx)) continue;
        const val = parseXbrlNum(raw, null);
        if (val !== null) return val;
      }
    }
  }
  return null;
}

/** 数値文字列をパース（カンマ・括弧・scale 対応） */
function parseXbrlNum(raw, scale) {
  const cleaned = (raw ?? "").replace(/<[^>]+>/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "—") return null;
  const neg = /^\(.*\)$/.test(cleaned);
  const numStr = cleaned.replace(/[(),\s]/g, "");
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  const val = neg ? -num : num;
  return scale != null ? val * Math.pow(10, Number(scale)) : val;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ── 財務概念名リスト（JGAAP + IFRS） ──────────────────
const CONCEPTS = {
  netProfit: [
    "jppfs_cor:ProfitLossAttributableToOwnersOfParent",
    "jpigp_cor:ProfitLossAttributableToOwnersOfParent",
    "ifrs-full:ProfitLossAttributableToOwnersOfParent",
    "jppfs_cor:NetIncomeLoss",
    "jppfs_cor:ProfitLoss",
    "jpigp_cor:ProfitLoss",
  ],
  equity: [
    "jppfs_cor:EquityAttributableToOwnersOfParent",
    "jpigp_cor:EquityAttributableToOwnersOfParent",
    "ifrs-full:EquityAttributableToOwnersOfParent",
    "jppfs_cor:NetAssets",
    "jpigp_cor:Equity",
    "ifrs-full:Equity",
  ],
  totalAssets: [
    "jppfs_cor:Assets",
    "jpigp_cor:Assets",
    "ifrs-full:Assets",
  ],
  sales: [
    "jppfs_cor:NetSales",
    "jpigp_cor:Revenue",
    "ifrs-full:Revenue",
    "jppfs_cor:OperatingRevenues",
    "jpigp_cor:NetSales",
  ],
  operatingProfit: [
    "jppfs_cor:OperatingProfit",
    "jpigp_cor:OperatingProfit",
    "ifrs-full:ProfitLossFromOperatingActivities",
    "jppfs_cor:OperatingIncomeLoss",
  ],
  eps: [
    "jppfs_cor:BasicEarningsLossPerShare",
    "jpigp_cor:BasicEarningsLossPerShare",
    "ifrs-full:BasicEarningsLossPerShare",
  ],
  bps: [
    "jppfs_cor:BookValuePerShare",
    "jpigp_cor:BookValuePerShare",
    "jppfs_cor:NetAssetsPerShare",
  ],
  equityRatio: [
    "jppfs_cor:EquityToAssetRatio",
    "jpigp_cor:EquityToAssetRatio",
  ],
};

// ── XBRLドキュメントから財務データを抽出 ────────────────
function parseFinancials(content, isIxbrl, periodEnd) {
  const extract = isIxbrl
    ? (names) => extractIxbrlValue(content, names)
    : (names) => extractTraditionalXbrlValue(content, names);

  const np  = extract(CONCEPTS.netProfit);
  const eq  = extract(CONCEPTS.equity);
  const ta  = extract(CONCEPTS.totalAssets);
  const sal = extract(CONCEPTS.sales);
  const op  = extract(CONCEPTS.operatingProfit);
  const eps = extract(CONCEPTS.eps);
  const bps = extract(CONCEPTS.bps);
  const eqr = extract(CONCEPTS.equityRatio);

  if (np == null || eq == null || eq === 0) return null;

  // 桁の妥当性チェック（ROE が -500%〜500% 範囲内か）
  const roe = (np / eq) * 100;
  if (Math.abs(roe) > 500) return null;

  const fiscalYear = Number(periodEnd.slice(0, 4));
  const today = new Date().toISOString().slice(0, 10);

  return {
    fiscal_year:          fiscalYear,
    fiscal_period_end:    periodEnd,
    roe:                  Math.round(roe * 100) / 100,
    net_income:           Math.round(np / 1_000_000),
    shareholders_equity:  Math.round(eq / 1_000_000),
    total_assets:         ta  != null ? Math.round(ta  / 1_000_000) : null,
    sales:                sal != null ? Math.round(sal / 1_000_000) : null,
    operating_profit:     op  != null ? Math.round(op  / 1_000_000) : null,
    eps:                  eps != null ? Math.round(eps * 100) / 100 : null,
    bps:                  bps != null ? Math.round(bps * 100) / 100 : null,
    equity_ratio:         eqr != null ? Math.round(eqr * 10000) / 100 : null,
    notes: `EDINET 有価証券報告書 XBRL から自動取得（${today}）。連結決算ベース。`,
  };
}

// ── EDINETからドキュメントをダウンロード ─────────────────
async function downloadDoc(docId, type) {
  const url = new URL(`${API_BASE}/documents/${docId}`);
  url.searchParams.set("type", String(type));
  url.searchParams.set("Subscription-Key", API_KEY);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  return { buffer: Buffer.from(await res.arrayBuffer()), ct };
}

// ── 1件の報告書を処理 ────────────────────────────────────
async function processFiling(filing) {
  const { doc_id, period_end } = filing;
  if (!doc_id || !period_end) return null;

  // キャッシュ確認
  const cacheFile = path.join(CACHE_DIR, `${doc_id}.json`);
  if (!FORCE) {
    try {
      return JSON.parse(await fs.readFile(cacheFile, "utf8"));
    } catch { /* キャッシュなし */ }
  }

  // type=5(要約) → type=1(本文) の順でダウンロード
  let buffer, ct;
  for (const type of [5, 1]) {
    try {
      ({ buffer, ct } = await downloadDoc(doc_id, type));
      if (ct.includes("zip") || ct.includes("octet")) break;
    } catch {
      buffer = null;
    }
  }
  if (!buffer) return null;

  // ZIP 展開
  let entries;
  try { entries = unzipEntries(buffer); } catch { return null; }
  if (!entries.length) return null;

  // iXBRL (HTM) or 従来型 XBRL (.xbrl) を優先検索
  // ファイルサイズ降順でソート（最大のHTMが本文）
  const htmEntries = entries
    .filter(e => /\.(htm|html)$/i.test(e.name))
    .sort((a, b) => b.data.length - a.data.length);
  const xbrlEntries = entries.filter(e => /\.xbrl$/i.test(e.name));

  let result = null;

  for (const entry of htmEntries) {
    const content = entry.data.toString("utf8");
    if (!content.includes("ix:nonFraction") && !content.includes("ix:header")) continue;
    result = parseFinancials(content, true, period_end);
    if (result) break;
  }

  if (!result) {
    for (const entry of xbrlEntries) {
      const content = entry.data.toString("utf8");
      result = parseFinancials(content, false, period_end);
      if (result) break;
    }
  }

  if (!result) return null;

  // キャッシュ保存
  const out = { company_code: filing.company_code, ...result,
    source_url: `https://disclosure.edinet-fsa.go.jp/E01EW/BLMainController.jsp?docID=${doc_id}` };
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(out, null, 2) + "\n", "utf8");
  return out;
}

// ── mergeMetrics ─────────────────────────────────────
function mergeMetrics(base, additions) {
  const map = new Map();
  for (const e of base)      map.set(`${e.company_code}_${e.fiscal_year}`, e);
  // EDINET は J-Quants より原典に近いため上書き
  for (const e of additions) map.set(`${e.company_code}_${e.fiscal_year}`, e);
  return [...map.values()].sort((a, b) =>
    a.company_code.localeCompare(b.company_code) || a.fiscal_year - b.fiscal_year
  );
}

// ── Main ─────────────────────────────────────────────
const filingsData = JSON.parse(await fs.readFile(FILINGS_FILE, "utf8"));
const filings     = (filingsData.filings ?? []).slice(0, LIMIT);
const metrics     = JSON.parse(await fs.readFile(METRICS_FILE, "utf8"));

console.log(`\n📊 EDINET XBRL 財務データ抽出`);
console.log(`   対象: ${filings.length} 件 / ${filingsData.total ?? "?"} 件（--limit=${LIMIT}）`);
console.log(`   既存 financial_metrics.json: ${metrics.length} 件\n`);

const newEntries = [];
let done = 0, success = 0, noData = 0, errors = 0;

for (const filing of filings) {
  done++;
  const pct = Math.round(done / filings.length * 100);
  process.stdout.write(
    `\r  [${pct}%] ${done}/${filings.length} 件  ✅${success} ⬜${noData} ❌${errors}   `
  );

  try {
    const result = await processFiling(filing);
    if (result) {
      success++;
      newEntries.push({
        company_code:        result.company_code,
        fiscal_year:         result.fiscal_year,
        roe:                 result.roe,
        pbr:                 null,
        tsr_3y_rank_percentile: null,
        net_income:          result.net_income,
        shareholders_equity: result.shareholders_equity,
        total_assets:        result.total_assets ?? null,
        sales:               result.sales ?? null,
        operating_profit:    result.operating_profit ?? null,
        eps:                 result.eps ?? null,
        bps:                 result.bps ?? null,
        equity_ratio:        result.equity_ratio ?? null,
        fiscal_period_end:   result.fiscal_period_end,
        source_url:          result.source_url,
        notes:               result.notes,
      });
    } else {
      noData++;
    }
  } catch (e) {
    errors++;
    if (errors <= 3) console.error(`\n   ⚠ ${filing.company_code} ${filing.doc_id}: ${e.message}`);
  }

  // 50件ごとに中間保存
  if (newEntries.length > 0 && done % 50 === 0) {
    const merged = mergeMetrics(metrics, newEntries);
    await fs.writeFile(METRICS_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8");
  }

  if (done < filings.length) await sleep(DELAY_MS);
}

// 最終保存
const finalData = mergeMetrics(metrics, newEntries);
await fs.writeFile(METRICS_FILE, JSON.stringify(finalData, null, 2) + "\n", "utf8");

console.log(`\n\n✅ 抽出完了！`);
console.log(`   成功: ${success} 件`);
console.log(`   XBRLなし / 取得不可: ${noData} 件`);
console.log(`   エラー: ${errors} 件`);
console.log(`\n✅ financial_metrics.json: ${finalData.length} 件（+${newEntries.length}）`);
console.log(`\n次のステップ:`);
console.log(`   npm run build   ← スクリーナーに反映`);
