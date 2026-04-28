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
  "blackrock_vote_cases.json",
  "amova_am_vote_cases.json",
  "mufg_am_vote_cases.json",
  "nissay_am_vote_cases.json",
  "sumitomo_mitsui_trust_am_vote_cases.json",
  "fidelity_japan_vote_cases.json",
];

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

function ensureCompany(companies, key, code, name) {
  if (!companies.has(key)) {
    companies.set(key, {
      company_code: code,
      company_name: name,
      against_count: 0,
      for_count: 0,        // 賛成票数も記録
      abstain_count: 0,    // 棄権
      investors: {},       // investor_id → { against, for }
      issues: {},          // issue_type → against count
      recent_against: [],  // 直近の反対事例（最大8件）
    });
  }
  const c = companies.get(key);
  c.company_code ||= code;
  c.company_name ||= name;
  return c;
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

  const investorId = parsed.investor_id ?? fileName.replace("_vote_cases.json", "");

  for (const issue of parsed.issues ?? []) {
    const issueType = issue.issue_type ?? "unknown";

    // ── 反対事例
    for (const rawExample of issue.against_examples ?? []) {
      const e = normalizeExample(rawExample);
      if (!e.company_code && !e.company_name) continue;
      const key = e.company_code || e.company_name;
      const c = ensureCompany(companies, key, e.company_code, e.company_name);

      c.against_count += 1;
      if (!c.investors[investorId]) c.investors[investorId] = { against: 0, for: 0 };
      c.investors[investorId].against += 1;
      c.issues[issueType] = (c.issues[issueType] ?? 0) + 1;

      if (c.recent_against.length < 8) {
        c.recent_against.push({
          investor_id: investorId,
          issue_type: issueType,
          meeting_date: e.meeting_date,
          proposal_type: e.proposal_type,
          reason: e.reason,
          source_url: e.source_url,
        });
      }
    }

    // ── 賛成事例（件数のみカウント、個別記録は保存しない）
    for (const rawExample of issue.for_examples ?? []) {
      const e = normalizeExample(rawExample);
      if (!e.company_code && !e.company_name) continue;
      const key = e.company_code || e.company_name;
      const c = ensureCompany(companies, key, e.company_code, e.company_name);

      c.for_count += 1;
      if (!c.investors[investorId]) c.investors[investorId] = { against: 0, for: 0 };
      c.investors[investorId].for += 1;
    }
  }

  // ── vote が直接 records 配列になっているフォーマット（BlackRock等）
  for (const record of parsed.records ?? []) {
    const e = normalizeExample({ ...record, investor_id: investorId });
    if (!e.company_code && !e.company_name) continue;
    const key = e.company_code || e.company_name;
    const c = ensureCompany(companies, key, e.company_code, e.company_name);

    const vote = e.vote;
    if (!c.investors[investorId]) c.investors[investorId] = { against: 0, for: 0 };

    if (vote === "反対" || vote === "AGAINST") {
      c.against_count += 1;
      c.investors[investorId].against += 1;
      const issueType = record.issue_type ?? "other";
      c.issues[issueType] = (c.issues[issueType] ?? 0) + 1;
      if (c.recent_against.length < 8) {
        c.recent_against.push({
          investor_id: investorId,
          issue_type: issueType,
          meeting_date: e.meeting_date,
          proposal_type: e.proposal_type,
          reason: e.reason,
          source_url: e.source_url,
        });
      }
    } else if (vote === "賛成" || vote === "FOR") {
      c.for_count += 1;
      c.investors[investorId].for += 1;
    } else if (vote === "棄権" || vote === "ABSTAIN") {
      c.abstain_count += 1;
    }
  }
}

// 反対件数の多い順にソート
const ranking = [...companies.values()]
  .filter(c => c.against_count > 0 || c.for_count > 0)
  .sort((a, b) => b.against_count - a.against_count);

// ── 賛否比率が計算できる企業を統計
const totalCompanies = ranking.length;
const withAgainst = ranking.filter(c => c.against_count > 0).length;
const withForOnly = ranking.filter(c => c.against_count === 0 && c.for_count > 0).length;

await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      purpose:
        "実際の行使実績がある企業の賛否記録。反対実績を優先表示。企業登録・ガバナンス補完の起点として使用。",
      source_files: CASE_FILES.filter(f => {
        try { return true; } catch { return false; }
      }),
      total_companies: totalCompanies,
      with_against: withAgainst,
      with_for_only: withForOnly,
      companies: ranking,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`✅ ${path.relative(ROOT, OUTPUT)}: ${totalCompanies}社（反対あり: ${withAgainst}社、賛成のみ: ${withForOnly}社）`);
