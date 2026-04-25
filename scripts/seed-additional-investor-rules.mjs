import fs from "node:fs";

const investorPath = "data/investors.json";
const sourcePath = "data/guideline_sources.json";
const rulePath = "data/guideline_rules.json";

const investors = JSON.parse(fs.readFileSync(investorPath, "utf8"));
for (const investor of investors) {
  if (investor.investor_id === "blackrock") {
    investor.investor_name = "BlackRock Investment";
  }
}
fs.writeFileSync(investorPath, `${JSON.stringify(investors, null, 2)}\n`);

const sources = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const sourceByInvestor = Object.fromEntries(
  sources
    .filter((source) => source.document_type === "guideline")
    .map((source) => [source.investor_id, source])
);

const rules = JSON.parse(fs.readFileSync(rulePath, "utf8"));
const existing = new Set(rules.map((rule) => rule.rule_id));

const configs = {
  nomura_am: { year: 2026 },
  resona_am: { year: 2026 },
  sumitomo_mitsui_trust_am: { year: 2026 },
  am_one: { year: 2025 },
  daiwa_am: { year: 2026 },
  amova_am: { year: 2026 },
  mufg_am: { year: 2025 },
  nissay_am: { year: 2026 },
  goldman_sachs_am: { year: 2025 },
  fidelity_japan: { year: 2024 },
};

const issueMeta = {
  board_independence: {
    category: "取締役会構成",
    metric: "independent_director_ratio",
    threshold: 33.3,
    unit: "%",
    appliesTo: "取締役会",
    text:
      "独立社外取締役比率が十分でない場合、取締役会構成に責任を持つ取締役を反対対象候補として確認する。",
    target: ["current_president", "board_chair", "nominating_committee_chair", "all_directors"],
    priority: ["nominating_committee_chair", "board_chair", "current_president"],
  },
  gender_diversity: {
    category: "取締役会構成",
    metric: "female_director_count",
    threshold: 1,
    unit: "名",
    appliesTo: "取締役会",
    text:
      "女性取締役または女性役員が不足する場合、指名委員長・取締役会議長・経営トップを反対対象候補として確認する。",
    target: ["nominating_committee_chair", "board_chair", "current_president"],
    priority: ["nominating_committee_chair", "board_chair", "current_president"],
  },
  low_roe: {
    category: "業績・資本効率",
    metric: "ROE",
    threshold: 5,
    unit: "%",
    appliesTo: "企業",
    text:
      "資本効率または業績が低位にある場合、経営トップ、CEO、代表権付き会長、取締役会議長を反対対象候補として確認する。",
    target: ["current_president", "current_ceo", "representative_chair", "board_chair"],
    priority: ["current_president", "current_ceo", "representative_chair", "board_chair"],
  },
  attendance: {
    category: "個別取締役",
    metric: "attendance_rate",
    threshold: 75,
    unit: "%",
    appliesTo: "取締役",
    text:
      "取締役会または委員会への出席率が低い場合、該当する取締役本人を反対対象候補として確認する。",
    target: ["specific_director"],
    priority: ["specific_director"],
  },
};

function structuredCondition(issueType, meta) {
  if (issueType === "low_roe") {
    return {
      issue_type: issueType,
      metric: meta.metric,
      period_years: 3,
      threshold: meta.threshold,
      operator: "below",
      aggregation: "consecutive",
      target_candidates: meta.target,
    };
  }

  if (issueType === "board_independence") {
    return {
      issue_type: issueType,
      metric: meta.metric,
      threshold: meta.threshold,
      threshold_unit: "percent",
      operator: "below",
      applies_to: "board",
      target_candidates: meta.target,
    };
  }

  if (issueType === "gender_diversity") {
    return {
      issue_type: issueType,
      metric: meta.metric,
      threshold: meta.threshold,
      operator: "below",
      applies_to: "board",
      target_candidates: meta.target,
    };
  }

  return {
    issue_type: issueType,
    metric: meta.metric,
    threshold: meta.threshold,
    threshold_unit: "percent",
    operator: "below",
    applies_to: "director",
    target_candidates: meta.target,
  };
}

for (const [investorId, config] of Object.entries(configs)) {
  const source = sourceByInvestor[investorId];
  const investorName = investors.find((investor) => investor.investor_id === investorId)?.investor_name ?? investorId;

  for (const [issueType, meta] of Object.entries(issueMeta)) {
    const ruleId = `${investorId.toUpperCase()}_${config.year}_${issueType.toUpperCase()}`;
    if (existing.has(ruleId)) continue;

    rules.push({
      rule_id: ruleId,
      investor_id: investorId,
      guideline_year: config.year,
      issue_type: issueType,
      issue_category: meta.category,
      condition_text: meta.text,
      summary_text: `${investorName}の公開方針・行使結果から、${meta.text}`,
      original_text:
        "公式ページおよび個別行使結果の記載を継続抽出中。現段階では、公開済みの議決権行使方針・行使結果に基づく主要論点として登録。",
      condition_structured: structuredCondition(issueType, meta),
      official_target_text:
        meta.appliesTo === "取締役"
          ? "該当する取締役本人"
          : "責任を有する取締役または関連委員会議長",
      target_candidates: meta.target,
      target_priority: meta.priority,
      calculation_method:
        issueType === "low_roe"
          ? "直近3期ROEと行使結果理由を照合。投資家ごとの明示閾値は継続抽出。"
          : issueType === "attendance"
            ? "出席率75%未満を暫定抽出し、公式基準・行使理由と照合。"
            : "会社開示の構成データと公式方針・行使理由を照合。",
      lookback_years: issueType === "low_roe" ? 3 : null,
      threshold_value: meta.threshold,
      threshold_unit: meta.unit,
      applies_to: meta.appliesTo,
      source_title: source?.title ?? `${investorName} 議決権行使方針`,
      source_url: source?.url ?? "",
      source_page: "公開方針・行使結果",
      confidence: "Medium",
      notes:
        "追加投資家のMVP初期ルール。公式文言の詳細抽出と過去行使結果による補正を継続する。",
    });

    existing.add(ruleId);
  }
}

fs.writeFileSync(rulePath, `${JSON.stringify(rules, null, 2)}\n`);
console.log(`Seeded investors=${investors.length}, rules=${rules.length}`);
