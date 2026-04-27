import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RECORD_DIR = path.join(ROOT, "data", "generated", "opposition_records_by_investor");
const FALLBACK_RECORDS_FILE = path.join(ROOT, "data", "generated", "investor_opposition_records.json");
const OUTPUT = path.join(ROOT, "data", "generated", "vote_record_quality_report.json");

function text(value) {
  return String(value ?? "").trim();
}

function hasReason(record) {
  return text(record.reason).length > 0;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

let groupedInputs = [];
try {
  const files = (await fs.readdir(RECORD_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();
  groupedInputs = files.map((file) => ({
    investorId: file.replace(/\.json$/, ""),
    filePath: path.join(RECORD_DIR, file),
    kind: "split",
  }));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (groupedInputs.length === 0) {
  try {
    const data = await readJson(FALLBACK_RECORDS_FILE);
    const records = Array.isArray(data.records) ? data.records : [];
    const byInvestor = new Map();
    for (const record of records) {
      const investorId = text(record.investor_id) || "unknown";
      const arr = byInvestor.get(investorId) ?? [];
      arr.push(record);
      byInvestor.set(investorId, arr);
    }
    groupedInputs = [...byInvestor.entries()].map(([investorId, records]) => ({
      investorId,
      records,
      kind: "combined",
    }));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const reports = [];
const samples = {
  for_with_reason: [],
  for_with_inferred_issue_no_reason: [],
  against_without_reason: [],
  unknown_vote: [],
};

for (const input of groupedInputs) {
  const data = input.records ? { records: input.records, investor_id: input.investorId } : await readJson(input.filePath);
  const records = Array.isArray(data.records) ? data.records : [];
  const investorId = data.investor_id ?? input.investorId;
  const counts = {
    total: records.length,
    for_with_reason: 0,
    for_with_inferred_issue_no_reason: 0,
    against_without_reason: 0,
    unknown_vote: 0,
  };

  for (const record of records) {
    const vote = text(record.vote);
    const reason = hasReason(record);
    const issue = text(record.issue_type);
    const compact = {
      investor_id: investorId,
      company_code: record.company_code,
      company_name: record.company_name,
      meeting_date: record.meeting_date,
      proposal_number: record.proposal_number,
      vote,
      issue_type: issue,
      reason: record.reason,
      source_url: record.source_url,
    };

    if (vote === "賛成" && reason) {
      counts.for_with_reason += 1;
      if (samples.for_with_reason.length < 30) samples.for_with_reason.push(compact);
    }
    if (vote === "賛成" && !reason && issue && issue !== "other") {
      counts.for_with_inferred_issue_no_reason += 1;
      if (samples.for_with_inferred_issue_no_reason.length < 30) samples.for_with_inferred_issue_no_reason.push(compact);
    }
    if (vote === "反対" && !reason) {
      counts.against_without_reason += 1;
      if (samples.against_without_reason.length < 30) samples.against_without_reason.push(compact);
    }
    if (!["賛成", "反対", "棄権", "判断", "不明"].includes(vote)) {
      counts.unknown_vote += 1;
      if (samples.unknown_vote.length < 30) samples.unknown_vote.push(compact);
    }
  }

  reports.push({ investor_id: investorId, ...counts });
}

const summary = reports.reduce(
  (acc, row) => {
    acc.total += row.total;
    acc.for_with_reason += row.for_with_reason;
    acc.for_with_inferred_issue_no_reason += row.for_with_inferred_issue_no_reason;
    acc.against_without_reason += row.against_without_reason;
    acc.unknown_vote += row.unknown_vote;
    return acc;
  },
  { total: 0, for_with_reason: 0, for_with_inferred_issue_no_reason: 0, against_without_reason: 0, unknown_vote: 0 }
);

await fs.writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      purpose: "議決権行使結果の正規化データについて、賛否・理由・推定論点の不整合候補を検出する品質監査レポート。",
      summary,
      by_investor: reports,
      samples,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log("Vote record quality audit");
console.log(JSON.stringify(summary, null, 2));
console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
