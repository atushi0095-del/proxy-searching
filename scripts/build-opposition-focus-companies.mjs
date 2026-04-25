import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT = path.join(GENERATED_DIR, "opposition_focus_companies.json");

const CASE_FILES = [
  "mufg_vote_cases.json",
  "nomura_am_vote_cases.json",
  "resona_am_vote_cases.json",
  "daiwa_am_vote_cases.json",
];

function addCount(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function normalizeExample(example) {
  return {
    investor_id: example.investor_id ?? "",
    company_code: String(example.company_code ?? "").trim(),
    company_name: String(example.company_name ?? "").trim(),
    meeting_date: String(example.meeting_date ?? example.meeting_year ?? "").trim(),
    proposal_type: String(example.proposal_type ?? "").trim(),
    vote: String(example.vote ?? "").trim(),
    reason: String(example.reason ?? "").trim(),
    source_url: String(example.source_url ?? "").trim(),
  };
}

const companies = new Map();

for (const fileName of CASE_FILES) {
  const filePath = path.join(GENERATED_DIR, fileName);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    continue;
  }

  for (const issue of parsed.issues ?? []) {
    const issueType = issue.issue_type ?? "unknown";
    for (const rawExample of issue.against_examples ?? []) {
      const example = normalizeExample(rawExample);
      if (!example.company_code && !example.company_name) continue;

      const key = example.company_code || example.company_name;
      if (!companies.has(key)) {
        companies.set(key, {
          company_code: example.company_code,
          company_name: example.company_name,
          against_count: 0,
          investors: {},
          issues: {},
          recent_examples: [],
        });
      }

      const company = companies.get(key);
      company.company_code ||= example.company_code;
      company.company_name ||= example.company_name;
      company.against_count += 1;
      company.investors[example.investor_id] = (company.investors[example.investor_id] ?? 0) + 1;
      company.issues[issueType] = (company.issues[issueType] ?? 0) + 1;

      if (company.recent_examples.length < 5) {
        company.recent_examples.push({
          investor_id: example.investor_id,
          issue_type: issueType,
          meeting_date: example.meeting_date,
          proposal_type: example.proposal_type,
          reason: example.reason,
          source_url: example.source_url,
        });
      }
    }
  }
}

const ranking = [...companies.values()].sort((a, b) => b.against_count - a.against_count);

await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      purpose:
        "反対された企業を中心に企業FACT・ガバナンス・候補者データを追加収集するための優先リスト。",
      source_files: CASE_FILES,
      total_companies: ranking.length,
      companies: ranking,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Built ${path.relative(ROOT, OUTPUT)} with ${ranking.length} companies`);
