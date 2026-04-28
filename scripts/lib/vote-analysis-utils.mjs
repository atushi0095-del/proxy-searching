export const AGAINST = "反対";
export const FOR = "賛成";

export const ISSUE_PATTERNS = [
  ["tenure", ["在任", "長期在任"]],
  ["low_roe", ["ROE", "自己資本利益率", "業績", "経営成績", "株主資本"]],
  ["low_pbr", ["PBR"]],
  ["low_tsr", ["TSR", "株価"]],
  ["board_independence", ["取締役会", "社外取締役", "独立社外取締役", "構成", "人数"]],
  ["gender_diversity", ["女性", "多様性", "ダイバーシティ"]],
  ["attendance", ["出席"]],
  ["overboarding", ["兼任", "兼職"]],
  ["policy_shareholdings", ["政策保有"]],
  ["independence_failure", ["独立性", "独立"]],
  ["compensation", ["報酬", "賞与", "退職慰労金", "ストックオプション"]],
  ["takeover_defense", ["買収防衛"]],
  ["shareholder_proposal", ["株主提案"]]
];

export function classifyReason(reason, proposalType = "", roleText = "") {
  const text = `${reason ?? ""} ${proposalType ?? ""} ${roleText ?? ""}`;
  const matched = ISSUE_PATTERNS.filter(([, terms]) =>
    terms.some((term) => text.includes(term))
  ).map(([issueType]) => issueType);
  return matched.length > 0 ? matched : ["other"];
}

export function normalizeVote(value) {
  const text = String(value ?? "");
  if (text.includes("反対")) return AGAINST;
  if (text.includes("賛成")) return FOR;
  if (text.includes("棄権")) return "棄権";
  if (text.includes("白紙")) return "白紙委任";
  return text || "UNKNOWN";
}

export function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

export function addCount(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

export function summarize(records) {
  const byVote = {};
  const byProposalType = {};
  const byIssueType = {};
  const byReason = {};
  for (const record of records) {
    addCount(byVote, record.vote);
    addCount(byProposalType, `${record.proposal_type} / ${record.vote}`);
    for (const issueType of record.issue_types) {
      addCount(byIssueType, `${issueType} / ${record.vote}`);
    }
    if (record.vote === AGAINST) addCount(byReason, record.reason || "理由なし");
  }
  return {
    generated_at: new Date().toISOString(),
    total_records: records.length,
    by_vote: byVote,
    by_proposal_type: byProposalType,
    by_issue_type: byIssueType,
    top_against_reasons: Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([reason, count]) => ({ reason, count }))
  };
}

export function buildCases(records, investorName) {
  const issueTypes = [...new Set(records.flatMap((record) => record.issue_types))]
    .filter((issueType) => issueType !== "other")
    .sort();
  return {
    generated_at: new Date().toISOString(),
    purpose: `${investorName}の個別開示から、反対理由と賛成近接事例を抽出するための中間データ。`,
    records,
    issues: issueTypes.map((issueType) => {
      const allAgainst = records.filter(
        (record) => record.vote === AGAINST && record.issue_types.includes(issueType)
      );
      const companyCodes = new Set(allAgainst.slice(0, 100).map((record) => record.company_code));
      const allNearbyFor = records.filter(
        (record) => record.vote === FOR && companyCodes.has(record.company_code)
      );
      return {
        issue_type: issueType,
        against_count: allAgainst.length,
        against_examples: allAgainst,
        for_comparison_count: allNearbyFor.length,
        for_comparison_examples: allNearbyFor.slice(0, 500),
        inference_hint: "反対理由と同一企業の賛成議案を比較し、公式基準と実際の反対対象を分けて確認する。"
      };
    })
  };
}
