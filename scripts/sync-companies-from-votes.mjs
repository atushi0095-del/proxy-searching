/**
 * sync-companies-from-votes.mjs
 *
 * 反対実績データ (opposition_focus_companies.json) から証券コードを抽出し、
 * 未登録の企業を company_universe.json に追加する。
 * EDINET ステップが後続で財務データ・市場区分を補完する前提。
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

async function loadJson(rel) {
  return JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
}
async function saveJson(rel, data) {
  await writeFile(path.join(ROOT, rel), JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ── 証券コードから市場区分を推定（JPX区分の目安。EDINET登録後は上書きされる）
function inferMarket(code) {
  const n = parseInt(code, 10);
  // グロース市場: 4ケタで G から始まるコードは存在しないが、
  // 既存 TSE 旧マザーズ/JASDAQ の目安として使う（粗め）
  if (n >= 4000 && n <= 4999) return "東証プライム"; // 化学・医薬が多い
  if (n >= 9900 && n <= 9999) return "東証スタンダード"; // 卸・サービス多め
  // それ以外はプライムかスタンダード。EDINET で上書き前提でプライムをデフォルトに
  return "東証プライム";
}

// ── セクター推定（証券コード範囲 → 業種の大まかな目安）
function inferSector(code) {
  const n = parseInt(code, 10);
  if (n >= 1000 && n < 2000) return "建設・不動産";
  if (n >= 2000 && n < 3000) return "食料品・水産";
  if (n >= 3000 && n < 4000) return "繊維・小売";
  if (n >= 4000 && n < 5000) return "化学・医薬品";
  if (n >= 5000 && n < 6000) return "鉄鋼・金属";
  if (n >= 6000 && n < 7000) return "機械・電気機器";
  if (n >= 7000 && n < 8000) return "輸送機器・精密";
  if (n >= 8000 && n < 9000) return "金融・保険";
  if (n >= 9000 && n < 9500) return "情報・通信・運輸";
  if (n >= 9500 && n < 9600) return "電気・ガス";
  return "サービス";
}

// ── main ──────────────────────────────────────────────

const universe = await loadJson("data/company_universe.json");
const existingCodes = new Set(universe.map(c => String(c.company_code)));

let sources = [];

// 1. opposition_focus_companies.json（反対実績あり企業）
try {
  const focus = await loadJson("data/generated/opposition_focus_companies.json");
  sources.push(...(focus.companies ?? []));
} catch {
  console.log("opposition_focus_companies.json not found, skipping.");
}

// 2. investor_opposition_summary.json（行使サマリー経由の企業）
try {
  const summary = await loadJson("data/generated/investor_opposition_summary.json");
  if (Array.isArray(summary.companies)) {
    sources.push(...summary.companies);
  }
} catch {
  // optional
}

// ── 重複排除・会社コードが有効なもののみ
const seenCodes = new Set(existingCodes);
let addedCount = 0;

for (const src of sources) {
  const code = String(src.company_code ?? "").trim();
  if (!code || !/^\d{4}$/.test(code)) continue;
  if (seenCodes.has(code)) continue;
  seenCodes.add(code);

  const name = String(src.company_name ?? "").trim() || `企業 ${code}`;

  universe.push({
    company_code: code,
    company_name: name,
    fiscal_year_end: "03", // デフォルト3月期。招集通知取得後に更新
    market: inferMarket(code),
    sector: inferSector(code),
    source_url: `https://www.jpx.co.jp/listing/co/profile/JP${code}.html`,
    notes: `vote_data_auto_registered: ${new Date().toISOString().slice(0, 10)}`,
  });
  addedCount++;
}

if (addedCount > 0) {
  // company_code 順にソート
  universe.sort((a, b) => String(a.company_code).localeCompare(String(b.company_code)));
  await saveJson("data/company_universe.json", universe);
  console.log(`✅ company_universe.json: ${addedCount}社追加（合計 ${universe.length}社）`);
} else {
  console.log(`✅ company_universe.json: 新規追加なし（合計 ${universe.length}社）`);
}
