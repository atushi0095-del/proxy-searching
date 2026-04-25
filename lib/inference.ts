import {
  getCompany,
  getCompanyGovernanceMetric,
  getDirectors,
  getFinancialMetrics,
  getGuidelineRules,
  getInvestor,
} from "@/lib/data";
import type {
  BasisType,
  CandidateIssueScore,
  Director,
  GuidelineRule,
  InvestorJudgment,
  IssueAssessment,
  IssueType,
  OppositionCandidate,
  OppositionLevel,
  TargetCandidate,
} from "@/lib/types";

export const issueLabels: Record<IssueType, string> = {
  board_independence: "取締役会の独立性",
  outside_director_ratio: "独立社外取締役比率",
  outside_director_independence: "社外取締役の独立性",
  gender_diversity: "女性取締役・女性役員",
  board_chair_independence: "取締役会議長の独立性",
  tenure: "社外取締役の在任期間",
  overboarding: "兼職数",
  attendance: "取締役会・委員会出席率",
  independence_failure: "独立性欠如",
  low_roe: "ROE基準",
  low_tsr: "TSR基準",
  low_pbr: "PBR基準",
  policy_shareholdings: "政策保有株式",
  compensation: "役員報酬・株式報酬",
  takeover_defense: "買収防衛策・ポイズンピル",
  shareholder_proposal: "株主提案への賛否判断",
};

export const issueTaxonomy: { category: string; issue: string; issue_type: IssueType }[] = [
  { category: "取締役会構成", issue: "取締役会の独立性", issue_type: "board_independence" },
  { category: "取締役会構成", issue: "独立社外取締役比率", issue_type: "outside_director_ratio" },
  { category: "取締役会構成", issue: "社外取締役の独立性", issue_type: "outside_director_independence" },
  { category: "取締役会構成", issue: "女性取締役・女性役員", issue_type: "gender_diversity" },
  { category: "取締役会構成", issue: "取締役会議長の独立性", issue_type: "board_chair_independence" },
  { category: "個別取締役", issue: "社外取締役の在任期間", issue_type: "tenure" },
  { category: "個別取締役", issue: "兼職数", issue_type: "overboarding" },
  { category: "個別取締役", issue: "取締役会・委員会出席率", issue_type: "attendance" },
  { category: "個別取締役", issue: "独立性欠如", issue_type: "independence_failure" },
  { category: "業績・資本効率", issue: "ROE基準", issue_type: "low_roe" },
  { category: "業績・株価", issue: "TSR基準", issue_type: "low_tsr" },
  { category: "市場評価", issue: "PBR基準", issue_type: "low_pbr" },
  { category: "資本政策", issue: "政策保有株式", issue_type: "policy_shareholdings" },
  { category: "報酬", issue: "役員報酬・株式報酬", issue_type: "compensation" },
  { category: "買収防衛策", issue: "買収防衛策・ポイズンピル", issue_type: "takeover_defense" },
  { category: "株主提案", issue: "株主提案への賛否判断", issue_type: "shareholder_proposal" },
];

function levelWeight(level: OppositionLevel): number {
  return { High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0 }[level];
}

function maxLevel(levels: OppositionLevel[]): OppositionLevel {
  return levels.reduce<OppositionLevel>(
    (max, level) => (levelWeight(level) > levelWeight(max) ? level : max),
    "Not likely"
  );
}

function basisForInvestor(investorId: string, inferred = false): BasisType {
  if (investorId === "blackrock") return inferred ? "推定パターン" : "公式ガイドライン";
  return inferred ? "過去事例による補正" : "公式基準ベース";
}

function isCandidateMatch(director: Director, candidate: TargetCandidate): boolean {
  switch (candidate) {
    case "current_president":
      return director.is_president;
    case "current_ceo":
      return director.is_ceo;
    case "current_chair":
      return director.is_chair;
    case "representative_chair":
      return director.is_chair && director.has_representative_authority;
    case "non_representative_chair":
      return director.is_chair && !director.has_representative_authority;
    case "board_chair":
      return director.is_board_chair;
    case "nominating_committee_chair":
      return director.is_nominating_committee_chair;
    case "compensation_committee_chair":
      return director.is_compensation_committee_chair;
    case "audit_committee_chair":
      return director.is_audit_committee_chair;
    case "specific_outside_director":
      return director.is_outside_director;
    case "specific_director":
      return true;
    case "all_directors":
      return true;
    case "top_executive":
      return director.is_president || director.is_ceo || director.has_representative_authority;
    case "inside_director":
      return director.is_inside_director;
    case "former_president_within_3_years":
    case "former_ceo_within_3_years":
      return false;
    default:
      return false;
  }
}

function recentRoe(companyCode: string, meetingYear: number) {
  return getFinancialMetrics(companyCode)
    .filter((metric) => metric.fiscal_year <= meetingYear && metric.roe !== null)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 3)
    .reverse();
}

function assessRule(rule: GuidelineRule, companyCode: string, meetingYear: number): IssueAssessment {
  const governance = getCompanyGovernanceMetric(companyCode, meetingYear);
  const directorList = getDirectors(companyCode, meetingYear);
  const roeValues = recentRoe(companyCode, meetingYear);
  let triggered = false;
  let level: OppositionLevel = "Not likely";
  let fact = "判定に必要な事実データが未登録です。";
  let inference = "事実データが不足しているため、過去行使結果との照合対象として保留します。";

  if (rule.issue_type === "low_roe") {
    triggered = roeValues.length === 3 && roeValues.every((metric) => (metric.roe ?? 999) < 5);
    level = triggered ? "High" : "Not likely";
    fact = roeValues.map((metric) => `${metric.fiscal_year}年: ROE ${metric.roe?.toFixed(1)}%`).join(" / ");
    inference = triggered
      ? `直近3期がすべて5%未満なので、${rule.official_target_text}に該当する社長・CEO・代表権付き会長・取締役会議長を反対候補として照合します。`
      : `直近3期のROEは ${fact} で、少なくとも1期が5%以上のため、低ROE基準単独では反対候補にしません。`;
  }

  if (rule.issue_type === "board_independence") {
    const ratio = governance?.independent_director_ratio ?? null;
    const threshold = rule.threshold_value ?? 33.3;
    triggered = ratio !== null && ratio < threshold;
    level = triggered ? "Medium-High" : "Not likely";
    fact = ratio === null ? fact : `独立取締役比率 ${ratio.toFixed(1)}%`;
    inference = ratio === null
      ? "独立取締役比率が未登録のため、招集通知・CG報告書の取り込み対象です。"
      : triggered
      ? `${ratio.toFixed(1)}%で基準の${threshold}%を下回るため、議長・指名委員長・経営トップのどれが反対対象かを行使結果で照合します。`
      : `${ratio.toFixed(1)}%で基準の${threshold}%以上のため、取締役会独立性基準は満たしています。`;
  }

  if (rule.issue_type === "gender_diversity") {
    const count = governance?.female_director_count ?? null;
    const threshold = rule.threshold_value ?? 1;
    triggered = count !== null && count < threshold;
    level = triggered ? "Medium-High" : "Not likely";
    fact = count === null ? fact : `女性取締役 ${count}名`;
    inference = count === null
      ? "女性取締役数が未登録のため、招集通知・CG報告書の取り込み対象です。"
      : triggered
      ? `女性取締役が${count}名で基準の${threshold}名を下回るため、指名委員長・議長・経営トップのどれに反対しているかを照合します。`
      : `女性取締役が${count}名で基準の${threshold}名以上のため、女性取締役基準は満たしています。`;
  }

  if (rule.issue_type === "tenure") {
    const outsideDirectors = directorList.filter((director) => director.is_outside_director);
    const matchedA = outsideDirectors.filter((director) => director.tenure_years_after_reelection > 12);
    const matchedB = outsideDirectors.filter((director) => director.tenure_years_before_meeting >= 12);
    triggered = matchedA.length > 0;
    level = triggered ? "Medium-High" : "Not likely";
    fact = outsideDirectors.length
      ? outsideDirectors
          .map((director) => `${director.name}: 現在${director.tenure_years_before_meeting}年 / 再任後${director.tenure_years_after_reelection}年`)
          .join(" / ")
      : "社外取締役データが未登録です。";
    inference = matchedA.length
      ? `再任後に12年を超える候補者が${matchedA.length}名います。MVPでは「13年目から反対」を主解釈にし、本人反対か独立性評価のみかを過去行使結果で検証します。`
      : matchedB.length
      ? `現在12年以上の候補者はいますが、再任後12年超パターンとの違いを確認中です。12年満了時点で反対する投資家かどうかを行使結果で検証します。`
      : `登録済み候補者は全員12年未満です。長期在任基準では反対しない事例として賛成データ側に蓄積します。`;
  }

  if (rule.issue_type === "attendance") {
    const matched = directorList.filter((director) => {
      const boardLow = director.board_attendance_rate !== null && director.board_attendance_rate < 75;
      const committeeLow = director.committee_attendance_rate !== null && director.committee_attendance_rate < 75;
      return boardLow || committeeLow;
    });
    triggered = matched.length > 0;
    level = triggered ? "Medium-High" : "Not likely";
    fact = matched.length
      ? matched.map((director) => `${director.name}: 出席率要確認`).join(" / ")
      : "登録済みデータでは75%未満の出席率は検出されません。";
    inference = triggered
      ? `75%未満の出席率が検出されたため、該当取締役本人に反対しているか、合理的理由で賛成しているかを照合します。`
      : `登録済み出席率は75%以上または未登録です。未登録分は招集通知から抽出する自動化対象です。`;
  }

  return {
    issue_type: rule.issue_type,
    issue_label: issueLabels[rule.issue_type],
    category: rule.issue_category,
    triggered,
    level,
    basis: basisForInvestor(rule.investor_id, rule.investor_id === "blackrock" && triggered),
    fact,
    guideline: rule.condition_text,
    inference,
    target_candidates: rule.target_candidates,
    source_url: rule.source_url,
  };
}

function scoreDirectorForAssessment(director: Director, assessment: IssueAssessment): CandidateIssueScore | null {
  if (!assessment.triggered) return null;
  if (!assessment.target_candidates.some((candidate) => isCandidateMatch(director, candidate))) return null;

  let level = assessment.level;
  let comment = assessment.inference;

  if (assessment.issue_type === "tenure") {
    if (!director.is_outside_director) return null;
    const after = director.tenure_years_after_reelection;
    const before = director.tenure_years_before_meeting;
    if (after > 12) {
      level = "Medium-High";
      comment = `現在${before}年、再任後${after}年です。Aパターン（12年超、13年目から反対）に該当するため、本人反対の可能性があります。`;
    } else if (before >= 12) {
      level = "Medium";
      comment = `現在${before}年です。Bパターン（12年満了時点で反対）に該当する可能性があり、過去行使結果で検証します。`;
    } else {
      return null;
    }
  }

  if (assessment.issue_type === "attendance") {
    const boardLow = director.board_attendance_rate !== null && director.board_attendance_rate < 75;
    const committeeLow = director.committee_attendance_rate !== null && director.committee_attendance_rate < 75;
    if (!boardLow && !committeeLow) return null;
    comment = `取締役会出席率が${director.board_attendance_rate ?? "未登録"}%です。75%未満の場合は本人反対、未登録の場合は抽出対象です。`;
  }

  return {
    issue_type: assessment.issue_type,
    issue_label: assessment.issue_label,
    level,
    basis: assessment.basis,
    comment,
  };
}

export function runJudgment(
  investorId: string,
  companyCode: string,
  meetingYear: number
): InvestorJudgment | null {
  const investor = getInvestor(investorId);
  const company = getCompany(companyCode);
  if (!investor || !company) return null;

  const rules = getGuidelineRules(investorId);
  const issue_assessments = rules.map((rule) => assessRule(rule, companyCode, meetingYear));
  const directorList = getDirectors(companyCode, meetingYear);

  const opposition_candidates: OppositionCandidate[] = directorList.map((director) => {
    const issue_scores = issue_assessments
      .map((assessment) => scoreDirectorForAssessment(director, assessment))
      .filter((score): score is CandidateIssueScore => score !== null);
    const overall_level = maxLevel(issue_scores.map((score) => score.level));
    return {
      director,
      issue_scores,
      overall_level,
      overall_comment:
        overall_level === "Not likely"
          ? "登録済み基準では反対対象候補として強くは検出されていません。賛成された企業・候補者の比較対象として蓄積します。"
          : "複数論点を合算せず、どの基準由来で反対可能性があるかを分けて表示しています。",
    };
  });

  return {
    investor,
    company,
    meeting_year: meetingYear,
    issue_assessments,
    opposition_candidates,
    disclaimer:
      "本判定は公開資料を構造化した分析支援であり、実際の議決権行使結果を保証しません。FACT、GUIDELINE、INFERENCEを分けて確認してください。",
  };
}
