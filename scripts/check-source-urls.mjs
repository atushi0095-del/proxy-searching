/**
 * check-source-urls.mjs
 * guideline_sources.json の全URLをHEADリクエストで確認し、
 * url_last_verified と url_status を更新して書き戻す。
 *
 * 実行: npm run check:urls
 *       npm run check:urls -- --investor=am_one  # 特定投資家のみ
 *       npm run check:urls -- --dry-run          # 書き戻しなし
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCES_FILE = path.join(ROOT, "data", "guideline_sources.json");

const args = process.argv.slice(2);
const investorFilter = args.find(a => a.startsWith("--investor="))?.replace("--investor=", "") ?? null;
const dryRun = args.includes("--dry-run");
const DELAY_MS = 2000; // robots.txt 準拠: 2秒ディレイ
const TIMEOUT_MS = 15000;
const USER_AGENT = "proxy-vote-pattern-app-url-checker/0.1 (research; non-commercial)";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const status = res.status;
    if (status >= 200 && status < 300) return { status: "verified", http: status, redirect_to: null };
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location") ?? null;
      return { status: "redirected", http: status, redirect_to: loc };
    }
    if (status === 404) return { status: "broken", http: status, redirect_to: null };
    return { status: "unverified", http: status, redirect_to: null };
  } catch (err) {
    if (err.name === "AbortError") return { status: "unverified", http: null, redirect_to: null, error: "timeout" };
    return { status: "unverified", http: null, redirect_to: null, error: String(err.message ?? err) };
  }
}

async function main() {
  const sources = JSON.parse(await readFile(SOURCES_FILE, "utf8"));
  const toCheck = investorFilter
    ? sources.filter(s => s.investor_id === investorFilter)
    : sources;

  console.log(`\n=== URLヘルスチェック: ${toCheck.length}件${investorFilter ? ` (investor=${investorFilter})` : ""}${dryRun ? " [DRY RUN]" : ""} ===\n`);

  const results = { verified: 0, redirected: 0, broken: 0, unverified: 0 };

  for (const source of toCheck) {
    process.stdout.write(`[${source.investor_id}] ${source.source_id} ... `);
    const check = await checkUrl(source.url);

    const icon = { verified: "✅", redirected: "↪️ ", broken: "❌", unverified: "⚠️ " }[check.status] ?? "?";
    const detail = check.redirect_to ? ` → ${check.redirect_to}` : check.error ? ` (${check.error})` : "";
    console.log(`${icon} ${check.status} [HTTP ${check.http ?? "—"}]${detail}`);

    // sources配列内の対象エントリを更新
    const idx = sources.findIndex(s => s.source_id === source.source_id);
    if (idx >= 0) {
      sources[idx].url_last_verified = today();
      sources[idx].url_status = check.status;
      if (check.redirect_to) sources[idx].redirect_to = check.redirect_to;
    }

    results[check.status] = (results[check.status] ?? 0) + 1;
    await sleep(DELAY_MS);
  }

  console.log(`\n── 結果サマリー ──────────────────────────`);
  console.log(`✅ verified:   ${results.verified}`);
  console.log(`↪️  redirected: ${results.redirected}`);
  console.log(`❌ broken:     ${results.broken}`);
  console.log(`⚠️  unverified: ${results.unverified}`);

  if (!dryRun) {
    await writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2));
    console.log(`\n✅ ${SOURCES_FILE} を更新しました。`);
  } else {
    console.log(`\n[DRY RUN] ファイルは更新されていません。`);
  }

  if (results.broken > 0) {
    console.log(`\n⚠️  破損URLが${results.broken}件あります。手動で確認・更新してください。`);
    process.exit(1);
  }
  if (results.redirected > 0) {
    console.log(`\n↪️  リダイレクトが${results.redirected}件あります。redirect_to フィールドを確認し、urlを更新することを検討してください。`);
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
