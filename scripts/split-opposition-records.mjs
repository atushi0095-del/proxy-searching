import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const INPUT = path.join(GENERATED_DIR, "investor_opposition_records.json");
const OUT_DIR = path.join(GENERATED_DIR, "opposition_records_by_investor");
const SUMMARY = path.join(GENERATED_DIR, "investor_opposition_summary.json");

const data = JSON.parse(await fs.readFile(INPUT, "utf8"));
const groups = new Map();
const againstByIssue = {};
const byInvestor = {};

for (const record of data.records ?? []) {
  const investorId = String(record.investor_id ?? "unknown");
  const arr = groups.get(investorId) ?? [];
  arr.push(record);
  groups.set(investorId, arr);

  byInvestor[investorId] ??= { total: 0, by_vote: {}, by_issue_type: {} };
  byInvestor[investorId].total += 1;
  byInvestor[investorId].by_vote[record.vote] = (byInvestor[investorId].by_vote[record.vote] ?? 0) + 1;
  byInvestor[investorId].by_issue_type[record.issue_type] = (byInvestor[investorId].by_issue_type[record.issue_type] ?? 0) + 1;

  if (record.vote === "反対") {
    againstByIssue[record.issue_type] = (againstByIssue[record.issue_type] ?? 0) + 1;
  }
}

await fs.mkdir(OUT_DIR, { recursive: true });
for (const [investorId, records] of groups.entries()) {
  const filePath = path.join(OUT_DIR, `${investorId}.json`);
  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      {
        generated_at: data.generated_at,
        investor_id: investorId,
        total_records: records.length,
        records,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`Wrote ${path.relative(ROOT, filePath)} with ${records.length} records`);
}

await fs.writeFile(
  SUMMARY,
  `${JSON.stringify(
    {
      generated_at: data.generated_at,
      total_records: data.total_records,
      against_by_issue: againstByIssue,
      by_investor: byInvestor,
    },
    null,
    2
  )}\n`,
  "utf8"
);
console.log(`Wrote ${path.relative(ROOT, SUMMARY)}`);
