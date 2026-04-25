/**
 * データ整合性チェックスクリプト
 * 実行: npx ts-node --project tsconfig.json scripts/validate-data.ts
 * または: npx tsx scripts/validate-data.ts
 */

import * as path from "path";
import * as fs from "fs";

const DATA_DIR = path.join(__dirname, "../data");

function loadJson<T>(filename: string): T {
  const filepath = path.join(DATA_DIR, filename);
  const raw = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

interface ValidationResult {
  file: string;
  check: string;
  status: "OK" | "WARN" | "ERROR";
  message: string;
}

const results: ValidationResult[] = [];

function ok(file: string, check: string, message: string) {
  results.push({ file, check, status: "OK", message });
}
function warn(file: string, check: string, message: string) {
  results.push({ file, check, status: "WARN", message });
}
function error(file: string, check: string, message: string) {
  results.push({ file, check, status: "ERROR", message });
}

// ─── データ読み込み ────────────────────────────────────────────────────────────
const investors = loadJson<{ investor_id: string; investor_name: string }[]>("investors.json");
const companies = loadJson<{ company_code: string; company_name: string }[]>("companies.json");
const directors = loadJson<{
  director_id: string;
  company_code: string;
  meeting_year: number;
  name: string;
  is_outside_director: boolean;
  tenure_years_before_meeting: number;
  tenure_years_after_reelection: number;
}[]>("directors.json");
const financialMetrics = loadJson<{
  company_code: string;
  fiscal_year: number;
  roe: number | null;
}[]>("financial_metrics.json");
const governanceMetrics = loadJson<{
  company_code: string;
  meeting_year: number;
  independent_director_ratio: number;
  female_director_count: number;
}[]>("company_governance_metrics.json");
const guidelineRules = loadJson<{
  rule_id: string;
  investor_id: string;
  issue_type: string;
  threshold_value: number | null;
}[]>("guideline_rules.json");
const voteResults = loadJson<{
  vote_result_id: string;
  investor_id: string;
  company_code: string;
  director_id: string | null;
  vote: string;
}[]>("vote_results.json");
const guidelineSources = loadJson<{
  source_id: string;
  investor_id: string;
  url: string;
}[]>("guideline_sources.json");

const investorIds = new Set(investors.map((i) => i.investor_id));
const companyCodes = new Set(companies.map((c) => c.company_code));

// ─── investors.json ────────────────────────────────────────────────────────────
if (investors.length > 0) {
  ok("investors.json", "件数", `${investors.length}件`);
  const ids = investors.map((i) => i.investor_id);
  const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (dupes.length) error("investors.json", "重複ID", `重複: ${dupes.join(", ")}`);
  else ok("investors.json", "重複チェック", "重複なし");
} else {
  error("investors.json", "件数", "0件 — データが空です");
}

// ─── companies.json ────────────────────────────────────────────────────────────
if (companies.length > 0) {
  ok("companies.json", "件数", `${companies.length}社`);
  const codes = companies.map((c) => c.company_code);
  const dupes = codes.filter((c, idx) => codes.indexOf(c) !== idx);
  if (dupes.length) error("companies.json", "重複コード", `重複: ${dupes.join(", ")}`);
  else ok("companies.json", "重複チェック", "重複なし");
} else {
  error("companies.json", "件数", "0件 — データが空です");
}

// ─── directors.json ────────────────────────────────────────────────────────────
ok("directors.json", "件数", `${directors.length}件`);
for (const d of directors) {
  if (!companyCodes.has(d.company_code)) {
    error("directors.json", "company_code参照", `${d.director_id}: company_code "${d.company_code}" が companies.json に存在しない`);
  }
  if (d.tenure_years_after_reelection < 0 || d.tenure_years_before_meeting < 0) {
    error("directors.json", "在任年数", `${d.director_id}: 在任年数が負の値`);
  }
  // after_reelection は before_meeting 以上であるべき（再任でさらに任期が加算される）
  if (d.tenure_years_after_reelection < d.tenure_years_before_meeting) {
    error("directors.json", "在任年数整合性", `${d.director_id}: tenure_years_after_reelection(${d.tenure_years_after_reelection}) < tenure_years_before_meeting(${d.tenure_years_before_meeting}) — 再任後が就任前より短いのは不整合`);
  }
}
// 各企業の取締役数チェック
for (const co of companies) {
  const count = directors.filter((d) => d.company_code === co.company_code).length;
  if (count === 0) warn("directors.json", "企業別件数", `${co.company_code}(${co.company_name}): 取締役データが0件`);
  else ok("directors.json", "企業別件数", `${co.company_code}: ${count}名`);
}

// ─── financial_metrics.json ────────────────────────────────────────────────────
ok("financial_metrics.json", "件数", `${financialMetrics.length}件`);
for (const co of companies) {
  const metrics = financialMetrics.filter((m) => m.company_code === co.company_code);
  if (metrics.length === 0) {
    warn("financial_metrics.json", "企業別件数", `${co.company_code}: 財務データが0件`);
  } else if (metrics.length < 3) {
    warn("financial_metrics.json", "企業別件数", `${co.company_code}: 財務データが${metrics.length}期分（3期未満）— ROE判定に注意`);
  } else {
    ok("financial_metrics.json", "企業別件数", `${co.company_code}: ${metrics.length}期分`);
  }
}
// ROEが全期5%未満の企業を列挙（low_roe該当候補）
for (const co of companies) {
  const metrics = financialMetrics
    .filter((m) => m.company_code === co.company_code && m.roe !== null)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 3);
  if (metrics.length === 3 && metrics.every((m) => (m.roe ?? 999) < 5)) {
    ok("financial_metrics.json", "low_roe該当", `${co.company_code}: 直近3期すべてROE5%未満 → low_roe抵触`);
  }
}

// ─── company_governance_metrics.json ──────────────────────────────────────────
ok("company_governance_metrics.json", "件数", `${governanceMetrics.length}件`);
for (const co of companies) {
  const g = governanceMetrics.find((m) => m.company_code === co.company_code);
  if (!g) warn("company_governance_metrics.json", "企業別データ", `${co.company_code}: ガバナンスデータが未登録`);
  else {
    if (g.independent_director_ratio < 33.3) {
      ok("company_governance_metrics.json", "board_independence", `${co.company_code}: 独立比率${g.independent_director_ratio}% < 33.3% → 抵触`);
    }
    if (g.female_director_count < 1) {
      ok("company_governance_metrics.json", "gender_diversity", `${co.company_code}: 女性取締役${g.female_director_count}名 < 1名 → 抵触`);
    }
  }
}

// ─── guideline_rules.json ──────────────────────────────────────────────────────
ok("guideline_rules.json", "件数", `${guidelineRules.length}件`);
for (const rule of guidelineRules) {
  if (!investorIds.has(rule.investor_id)) {
    error("guideline_rules.json", "investor_id参照", `${rule.rule_id}: investor_id "${rule.investor_id}" が investors.json に存在しない`);
  }
}
// 各投資家のルール件数
for (const inv of investors) {
  const count = guidelineRules.filter((r) => r.investor_id === inv.investor_id).length;
  ok("guideline_rules.json", "投資家別件数", `${inv.investor_id}: ${count}ルール`);
}

// ─── vote_results.json ────────────────────────────────────────────────────────
ok("vote_results.json", "件数", `${voteResults.length}件`);
for (const vr of voteResults) {
  if (!investorIds.has(vr.investor_id)) {
    error("vote_results.json", "investor_id参照", `${vr.vote_result_id}: investor_id "${vr.investor_id}" が存在しない`);
  }
  if (!["FOR", "AGAINST", "ABSTAIN"].includes(vr.vote)) {
    error("vote_results.json", "vote値", `${vr.vote_result_id}: vote "${vr.vote}" は無効な値`);
  }
  // SAMPLE_X/Y/Z は参考事例なのでcompany_code不整合は許容
  if (!vr.company_code.startsWith("SAMPLE") && !companyCodes.has(vr.company_code)) {
    error("vote_results.json", "company_code参照", `${vr.vote_result_id}: company_code "${vr.company_code}" が companies.json に存在しない`);
  }
}

// ─── guideline_sources.json ───────────────────────────────────────────────────
ok("guideline_sources.json", "件数", `${guidelineSources.length}件`);
for (const src of guidelineSources) {
  if (!investorIds.has(src.investor_id)) {
    error("guideline_sources.json", "investor_id参照", `${src.source_id}: investor_id "${src.investor_id}" が存在しない`);
  }
  if (!src.url.startsWith("http")) {
    warn("guideline_sources.json", "URL", `${src.source_id}: URLが未設定または不正`);
  }
}

// ─── 結果表示 ──────────────────────────────────────────────────────────────────
const errors = results.filter((r) => r.status === "ERROR");
const warns = results.filter((r) => r.status === "WARN");
const oks = results.filter((r) => r.status === "OK");

console.log("\n=== データ整合性チェック結果 ===\n");
console.log(`✅ OK:    ${oks.length}件`);
console.log(`⚠️  WARN:  ${warns.length}件`);
console.log(`❌ ERROR: ${errors.length}件\n`);

if (errors.length > 0) {
  console.log("── ERROR ──────────────────────────────");
  for (const r of errors) {
    console.log(`❌ [${r.file}] ${r.check}: ${r.message}`);
  }
  console.log("");
}

if (warns.length > 0) {
  console.log("── WARN ───────────────────────────────");
  for (const r of warns) {
    console.log(`⚠️  [${r.file}] ${r.check}: ${r.message}`);
  }
  console.log("");
}

console.log("── OK（抜粋）──────────────────────────");
for (const r of oks.slice(0, 20)) {
  console.log(`✅ [${r.file}] ${r.check}: ${r.message}`);
}
if (oks.length > 20) console.log(`   ... 他${oks.length - 20}件`);

console.log(`\n終了ステータス: ${errors.length > 0 ? "FAILED" : "PASSED"}`);
process.exit(errors.length > 0 ? 1 : 0);
