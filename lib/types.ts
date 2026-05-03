export type IssueType =
  | "board_independence"
  | "outside_director_ratio"
  | "outside_director_independence"
  | "gender_diversity"
  | "board_chair_independence"
  | "tenure"
  | "overboarding"
  | "attendance"
  | "independence_failure"
  | "low_roe"
  | "low_tsr"
  | "low_pbr"
  | "policy_shareholdings"
  | "compensation"
  | "takeover_defense"
  | "shareholder_proposal";

export type IssueCategory =
  | "取締役会構成"
  | "個別取締役"
  | "業績・資本効率"
  | "業績・株価"
  | "市場評価"
  | "資本政策"
  | "報酬"
  | "買収防衛策"
  | "株主提案";

export type TargetCandidate =
  | "current_president"
  | "current_ceo"
  | "current_chair"
  | "representative_chair"
  | "non_representative_chair"
  | "former_president_within_3_years"
  | "former_ceo_within_3_years"
  | "board_chair"
  | "nominating_committee_chair"
  | "compensation_committee_chair"
  | "audit_committee_chair"
  | "specific_outside_director"
  | "specific_director"
  | "all_directors"
  | "top_executive"
  | "inside_director";

export type Confidence = "High" | "Medium-High" | "Medium" | "Low";
export type BasisType =
  | "公式ガイドライン"
  | "公式基準ベース"
  | "過去行使結果"
  | "過去事例による補正"
  | "推定パターン";
export type OppositionLevel = "High" | "Medium-High" | "Medium" | "Low" | "Not likely";

export interface Investor {
  investor_id: string;
  investor_name: string;
  country: string;
  investor_type: string;
  applies_to_japan: boolean;
  basis_policy: string;
  notes: string;
}

export interface ConditionStructured {
  issue_type?: IssueType;
  metric: string;
  period_years?: number;
  threshold?: number;
  operator?: string;
  aggregation?: string;
  comparison?: string;
  benchmark?: string;
  threshold_rank?: string;
  calculation_patterns?: string[];
  target_candidates?: TargetCandidate[];
  applies_to?: string;
}

export interface GuidelineRule {
  rule_id: string;
  investor_id: string;
  guideline_year: number;
  issue_type: IssueType;
  issue_category: IssueCategory;
  condition_text: string;
  summary_text: string;
  original_text: string;
  condition_structured: ConditionStructured | null;
  official_target_text: string;
  target_candidates: TargetCandidate[];
  target_priority: TargetCandidate[];
  calculation_method: string;
  lookback_years: number | null;
  threshold_value: number | null;
  threshold_unit: string;
  applies_to: string;
  source_title: string;
  source_url: string;
  source_page: string;
  confidence: Confidence;
  notes: string;
}

export interface Company {
  company_code: string;
  company_name: string;
  fiscal_year_end: string;
  market: string;
  sector: string;
  source_url: string;
  topix_component?: boolean;
}

export interface FinancialMetric {
  company_code: string;
  fiscal_year: number;
  roe: number | null;
  pbr: number | null;
  tsr_3y_rank_percentile: number | null;
  net_income: number | null;
  shareholders_equity: number | null;
  total_assets?: number | null;
  sales?: number | null;
  operating_profit?: number | null;
  eps?: number | null;
  bps?: number | null;
  equity_ratio?: number | null;
  fiscal_period_end?: string;
  is_forecast?: boolean;
  forecast_basis_year?: number;
  source_url: string;
  notes: string;
}

export interface Director {
  director_id: string;
  company_code: string;
  meeting_year: number;
  name: string;
  current_title: string;
  is_inside_director: boolean;
  is_outside_director: boolean;
  is_independent: boolean;
  is_president: boolean;
  is_ceo: boolean;
  is_chair: boolean;
  has_representative_authority: boolean;
  is_board_chair: boolean;
  is_nominating_committee_member: boolean;
  is_nominating_committee_chair: boolean;
  is_compensation_committee_member: boolean;
  is_compensation_committee_chair: boolean;
  is_audit_committee_member: boolean;
  is_audit_committee_chair: boolean;
  tenure_years_before_meeting: number;
  tenure_years_after_reelection: number;
  board_attendance_rate: number | null;
  committee_attendance_rate: number | null;
  outside_board_seats: number;
  listed_company_board_seats: number;
  is_female: boolean;
  source_url: string;
  notes: string;
}

export interface CompanyGovernanceMetric {
  company_code: string;
  meeting_year: number;
  board_size: number;
  inside_director_count: number;
  outside_director_count: number;
  independent_director_count: number;
  female_director_count: number;
  female_director_ratio: number;
  independent_director_ratio: number;
  has_independent_board_chair: boolean;
  has_nominating_committee: boolean;
  has_compensation_committee: boolean;
  policy_shareholdings_ratio: number | null;
  source_url: string;
  notes: string;
}

export interface VoteResult {
  vote_result_id: string;
  investor_id: string;
  company_code: string;
  meeting_year: number;
  proposal_number: string;
  proposal_type: string;
  director_id: string | null;
  director_name: string;
  vote: "FOR" | "AGAINST" | "ABSTAIN" | "UNKNOWN";
  reason: string;
  source_url: string;
  source_page: string;
  notes: string;
}

export interface GuidelineSource {
  source_id: string;
  investor_id: string;
  document_type: "guideline" | "guideline_changes" | "vote_result";
  year: number;
  title: string;
  url: string;
  language: "ja" | "en";
  retrieved_at: string;
  notes: string;
}

export interface IssueAssessment {
  issue_type: IssueType;
  issue_label: string;
  category: IssueCategory;
  triggered: boolean;
  level: OppositionLevel;
  basis: BasisType;
  fact: string;
  guideline: string;
  inference: string;
  target_candidates: TargetCandidate[];
  source_url: string;
}

export interface CandidateIssueScore {
  issue_type: IssueType;
  issue_label: string;
  level: OppositionLevel;
  basis: BasisType;
  comment: string;
}

export interface OppositionCandidate {
  director: Director;
  issue_scores: CandidateIssueScore[];
  overall_level: OppositionLevel;
  overall_comment: string;
}

export interface InvestorJudgment {
  investor: Investor;
  company: Company;
  meeting_year: number;
  issue_assessments: IssueAssessment[];
  opposition_candidates: OppositionCandidate[];
  disclaimer: string;
}
