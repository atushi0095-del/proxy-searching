// data/generated/agm_vote_results/*.json の抽出品質を監査する。
// EDINET APIを叩かず、既存のシャードだけを読んで異常値を検出する。
//
// 検出するパターン:
//   A. huge_number    — votes_for/against/abstain が桁溢れ級に大きい（HTML解析時の数字結合バグ）
//   B. pct_mismatch   — 報告された approval_pct が votes_for/(for+against+abstain) と大きく乖離
//                       （列の意味を取り違えている、または注記の数字を誤って拾っている）
//   C. footnote_title — proposal_title が議案名ではなく脚注文言に見える
//
// Usage: node scripts/audit-agm-vote-results.mjs [--pct-tolerance=15]
import fs from "node:fs/promises";
import path from "node:path";
import { resolveRecord, computedApprovalPct } from "./lib/vote-quality.mjs";

const ROOT = process.cwd();
const SHARD_DIR = path.join(ROOT, "data", "generated", "agm_vote_results");
const REPORT_FILE = path.join(ROOT, "data", "generated", "agm_vote_results_audit.json");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);
const PCT_TOLERANCE = Number(args.get("pct-tolerance") ?? 15);

function looksLikeFootnoteTitle(title) {
  const t = String(title ?? "");
  // 「第N号議案」の後に議案名の実質テキストがほぼ残らない（記号・注記のみ）
  const afterNo = t.replace(/^第[0-9]+号議案/, "");
  if (afterNo.length === 0) return true;
  if (/^[（(]\s*(数字|注|※)/.test(afterNo)) return true;
  return false;
}

async function main() {
  const files = (await fs.readdir(SHARD_DIR)).filter((name) => name.endsWith(".json"));
  console.log(`監査対象: ${files.length} 社分のシャード`);

  const flagged = [];
  let totalRecords = 0;

  for (const file of files) {
    const companyCode = path.basename(file, ".json");
    const shard = JSON.parse(await fs.readFile(path.join(SHARD_DIR, file), "utf8"));
    for (const meeting of shard.meetings) {
      for (const proposal of meeting.proposals) {
        totalRecords++;
        const issues = [];
        const resolved = resolveRecord(proposal, PCT_TOLERANCE);

        if (resolved.data_quality === "suspect") {
          issues.push("suspect");
        }
        if (resolved.approval_pct_source === "corrected_complement" && proposal.approval_pct_source !== "corrected_complement") {
          issues.push("needs_complement_correction");
        }
        if (looksLikeFootnoteTitle(proposal.proposal_title)) {
          issues.push("footnote_title");
        }

        if (issues.length > 0) {
          flagged.push({
            company_code: companyCode,
            company_name: shard.company_name,
            meeting_date: meeting.meeting_date,
            doc_id: meeting.doc_id,
            proposal_no: proposal.proposal_no,
            candidate_name: proposal.candidate_name,
            proposal_title: proposal.proposal_title,
            votes_for: proposal.votes_for,
            votes_against: proposal.votes_against,
            votes_abstain: proposal.votes_abstain,
            approval_pct: proposal.approval_pct,
            computed_pct: computedApprovalPct(proposal),
            issues,
          });
        }
      }
    }
  }

  const byIssue = {};
  for (const item of flagged) {
    for (const issue of item.issues) byIssue[issue] = (byIssue[issue] ?? 0) + 1;
  }
  const affectedCompanies = new Set(flagged.map((item) => item.company_code));
  const affectedMeetings = new Set(flagged.map((item) => `${item.company_code}:${item.meeting_date}`));

  console.log(`\n総レコード数: ${totalRecords.toLocaleString()}`);
  console.log(`異常フラグ件数: ${flagged.length.toLocaleString()} (${((flagged.length / totalRecords) * 100).toFixed(2)}%)`);
  console.log(`内訳:`, byIssue);
  console.log(`影響企業数: ${affectedCompanies.size} / ${files.length} 社 (${((affectedCompanies.size / files.length) * 100).toFixed(1)}%)`);
  console.log(`影響総会数: ${affectedMeetings.size}`);

  await fs.writeFile(
    REPORT_FILE,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pct_tolerance: PCT_TOLERANCE,
        total_records: totalRecords,
        flagged_count: flagged.length,
        by_issue: byIssue,
        affected_companies: affectedCompanies.size,
        affected_meetings: affectedMeetings.size,
        total_companies: files.length,
        flagged_records: flagged,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`\n詳細: ${path.relative(ROOT, REPORT_FILE)}`);
}

await main();
