import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT = path.join(GENERATED_DIR, "investor_opposition_records.json");

const CASE_FILES = [
  "mufg_vote_cases.json",
  "nomura_am_vote_cases.json",
  "resona_am_vote_cases.json",
  "daiwa_am_vote_cases.json",
];

function text(value) {
  return String(value ?? "").trim();
}

function normalizeVote(value) {
  const vote = text(value);
  if (vote.includes("反対") || vote.includes("蜿榊ｯｾ")) return "反対";
  if (vote.includes("賛成") || vote.includes("雉帶")) return "賛成";
  return vote || "不明";
}

const records = [];
const seen = new Set();

for (const fileName of CASE_FILES) {
  const filePath = path.join(GENERATED_DIR, fileName);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    continue;
  }

  for (const issue of parsed.issues ?? []) {
    const issueType = text(issue.issue_type) || "other";
    for (const raw of issue.against_examples ?? []) {
      const record = {
        investor_id: text(raw.investor_id),
        company_code: text(raw.company_code),
        company_name: text(raw.company_name),
        meeting_date: text(raw.meeting_date ?? raw.meeting_year),
        proposal_number: text(raw.proposal_number),
        proposal_type: text(raw.proposal_type),
        director_or_role: text(raw.director_name ?? raw.role_text),
        vote: normalizeVote(raw.vote),
        issue_type: issueType,
        reason: text(raw.reason),
        source_url: text(raw.source_url),
        source_title: text(raw.source_title),
      };

      const key = [
        record.investor_id,
        record.company_code,
        record.meeting_date,
        record.proposal_number,
        record.issue_type,
        record.reason,
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    }
  }
}

records.sort((a, b) => {
  if (a.investor_id !== b.investor_id) return a.investor_id.localeCompare(b.investor_id);
  if (a.company_code !== b.company_code) return a.company_code.localeCompare(b.company_code);
  return b.meeting_date.localeCompare(a.meeting_date);
});

await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      purpose: "投資家別に反対先・反対理由・推定論点を一覧表示し、CSV出力するための正規化データ。",
      source_files: CASE_FILES,
      total_records: records.length,
      records,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Built ${path.relative(ROOT, OUTPUT)} with ${records.length} records`);
