// 既存の data/generated/agm_vote_results/*.json に品質補正・data_quality フラグを適用する。
// vote-report-parser.mjs の resolveRecord() 導入前に生成されたシャードは
// 反対割合との取り違えが未補正・data_quality未付与のため、一度実行して補修する。
// EDINET APIは呼ばない（ローカル完結、既存JSONの読み書きのみ）。
import fs from "node:fs/promises";
import path from "node:path";
import { resolveRecord } from "./lib/vote-quality.mjs";

const ROOT = process.cwd();
const SHARD_DIR = path.join(ROOT, "data", "generated", "agm_vote_results");

const files = (await fs.readdir(SHARD_DIR)).filter((name) => name.endsWith(".json"));
let updatedShards = 0;
let suspectCount = 0;
let correctedCount = 0;
let totalCount = 0;

for (const file of files) {
  const shardPath = path.join(SHARD_DIR, file);
  const shard = JSON.parse(await fs.readFile(shardPath, "utf8"));
  let changed = false;

  for (const meeting of shard.meetings) {
    for (const proposal of meeting.proposals) {
      totalCount++;
      const resolved = resolveRecord(proposal);
      if (resolved.approval_pct_source === "corrected_complement" && proposal.approval_pct_source !== "corrected_complement") {
        correctedCount++;
      }
      if (
        proposal.approval_pct !== resolved.approval_pct ||
        proposal.approval_pct_source !== resolved.approval_pct_source ||
        proposal.data_quality !== resolved.data_quality
      ) {
        proposal.approval_pct = resolved.approval_pct;
        proposal.approval_pct_source = resolved.approval_pct_source;
        proposal.data_quality = resolved.data_quality;
        changed = true;
      }
      if (resolved.data_quality === "suspect") suspectCount++;
    }
  }

  if (changed) {
    await fs.writeFile(shardPath, `${JSON.stringify(shard, null, 2)}\n`, "utf8");
    updatedShards++;
  }
}

console.log(`対象: ${files.length} シャード / 更新: ${updatedShards} シャード`);
console.log(`総レコード: ${totalCount.toLocaleString()}`);
console.log(`反対割合取り違えを補正: ${correctedCount.toLocaleString()} 件`);
console.log(`最終的に suspect（非表示対象）: ${suspectCount.toLocaleString()} (${((suspectCount / totalCount) * 100).toFixed(2)}%)`);
