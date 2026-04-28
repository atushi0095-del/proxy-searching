"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InvestorOppositionTable } from "@/components/InvestorOppositionTable";

interface VoteRecord {
  investor_id: string;
  company_code: string;
  company_name: string;
  meeting_date: string;
  proposal_number: string;
  resolution_number?: string;
  candidate_number?: string;
  proposal_type: string;
  proposal_title_normalized?: string;
  director_or_role: string;
  vote: string;
  issue_type: string;
  detail_tags?: string[];
  target_label?: string;
  target_resolution_type?: string;
  target_candidate_number?: string;
  match_method?: string;
  target_confidence?: string;
  target_notes?: string;
  matched_director_id?: string;
  matched_director_name?: string;
  matched_director_title?: string;
  matched_director_attributes?: string[];
  director_match_method?: string;
  director_match_confidence?: string;
  director_match_notes?: string;
  reason: string;
  source_url: string;
  source_title: string;
  convocation_notice_url?: string;
}

interface FinancialMetric {
  company_code: string;
  fiscal_year: number;
  roe: number | null;
  pbr: number | null;
  tsr_3y_rank_percentile?: number | null;
  source_url: string;
  notes: string;
}

interface GovernanceMetric {
  company_code: string;
  meeting_year: number;
  independent_director_ratio: number;
  female_director_ratio: number;
  policy_shareholdings_ratio: number | null;
  source_url: string;
  notes: string;
}

interface Director {
  director_id?: string;
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
  tenure_years_before_meeting?: number;
  tenure_years_after_reelection?: number;
  board_attendance_rate?: number | null;
  committee_attendance_rate?: number | null;
  outside_board_seats?: number;
  listed_company_board_seats?: number;
  is_female: boolean;
}

interface DirectorRoleHistory {
  director_id: string;
  company_code: string;
  name: string;
  role_type: string;
  role_title: string;
  start_year: number;
  end_year: number | null;
  has_representative_authority: boolean;
  confidence: string;
  notes: string;
}

type VoteFilter = "all" | "反対" | "賛成";
type Operator = "none" | "below" | "below_or_equal" | "above" | "above_or_equal";
type MetricKey =
  | "none"
  | "roe"
  | "pbr"
  | "tsr_3y_rank_percentile"
  | "policy_shareholdings_ratio"
  | "independent_director_ratio"
  | "female_director_ratio"
  | "tenure_before"
  | "tenure_after"
  | "board_attendance_rate"
  | "outside_board_seats"
  | "listed_company_board_seats";

interface SavedCondition {
  id: string;
  name: string;
  vote: VoteFilter;
  issueType: string;
  detailTag: string;
  roleCondition: string;
  keyword: string;
  metricKey: MetricKey;
  metricOperator: Operator;
  metricThreshold: string;
  metricPeriods: string;
}

interface Props {
  investorId: string;
  records: VoteRecord[];
  financialMetrics: FinancialMetric[];
  governanceMetrics: GovernanceMetric[];
  directors: Director[];
  roleHistory: DirectorRoleHistory[];
}

const issueLabels: Record<string, string> = {
  attendance: "出席率",
  board_independence: "取締役会独立性",
  board_chair_independence: "議長独立性",
  compensation: "役員報酬",
  gender_diversity: "女性・ジェンダー",
  independence_failure: "独立性欠如",
  low_pbr: "PBR",
  low_roe: "ROE・資本効率",
  low_tsr: "TSR・株価",
  outside_director_independence: "社外取締役独立性",
  outside_director_ratio: "独立社外比率",
  overboarding: "兼職数",
  policy_shareholdings: "政策保有株式",
  shareholder_proposal: "株主提案",
  takeover_defense: "買収防衛策",
  tenure: "在任期間",
  other: "その他",
};

const roleConditionLabels: Record<string, string> = {
  all: "指定なし",
  current_president_or_ceo: "現任社長/CEOがいる",
  current_representative_chair: "現任の代表権付き会長がいる",
  current_board_chair: "取締役会議長がいる",
  current_inside_director: "社内取締役がいる",
  current_outside_director: "社外取締役がいる",
  current_independent_outside_director: "独立社外取締役がいる",
  current_female_director: "女性取締役がいる",
  current_female_outside_director: "女性社外取締役がいる",
  former_president_within_3_years: "過去3年以内の社長/CEO経験者がいる",
  former_representative_chair_within_3_years: "過去3年以内の代表権付き会長経験者がいる",
};

const metricLabels: Record<MetricKey, string> = {
  none: "指定なし",
  roe: "ROE",
  pbr: "PBR",
  tsr_3y_rank_percentile: "3年TSR順位",
  policy_shareholdings_ratio: "政策保有株式比率",
  independent_director_ratio: "独立社外取締役比率",
  female_director_ratio: "女性取締役比率",
  tenure_before: "総会前在任年数",
  tenure_after: "再任後在任年数",
  board_attendance_rate: "取締役会出席率",
  outside_board_seats: "社外兼職数",
  listed_company_board_seats: "上場会社役員兼職数",
};

const operatorLabels: Record<Operator, string> = {
  none: "指定なし",
  below: "未満",
  below_or_equal: "以下",
  above: "超",
  above_or_equal: "以上",
};

function issueLabel(issue: string) {
  return issueLabels[issue] ?? issue;
}

function getDirectorAttributeTags(director: Director): { label: string; color: string }[] {
  const tags: { label: string; color: string }[] = [];
  if (director.is_president) tags.push({ label: "社長", color: "bg-red-50 text-red-700" });
  if (director.is_ceo) tags.push({ label: "CEO", color: "bg-red-50 text-red-700" });
  if (director.is_chair && director.has_representative_authority) tags.push({ label: "代表会長", color: "bg-orange-50 text-orange-700" });
  else if (director.is_chair) tags.push({ label: "会長", color: "bg-orange-50 text-orange-700" });
  if (director.has_representative_authority && !director.is_president && !director.is_ceo && !director.is_chair) tags.push({ label: "代表権", color: "bg-orange-50 text-orange-700" });
  if (director.is_board_chair) tags.push({ label: "取締役会議長", color: "bg-purple-50 text-purple-700" });
  if (director.is_outside_director) tags.push({ label: "社外", color: "bg-blue-50 text-blue-700" });
  if (director.is_independent) tags.push({ label: "独立", color: "bg-green-50 text-green-700" });
  if (director.is_female) tags.push({ label: "女性", color: "bg-rose-50 text-rose-700" });
  if (!director.is_outside_director && !director.is_president && !director.is_ceo && !director.is_chair) tags.push({ label: "社内取締役", color: "bg-slate-100 text-slate-700" });
  if (director.tenure_years_before_meeting != null) tags.push({ label: `在任${director.tenure_years_before_meeting}年`, color: "bg-slate-50 text-slate-600" });
  return tags;
}

function matchedDirectorObjectsFull(
  record: VoteRecord,
  directors: Director[],
  roleHistory: DirectorRoleHistory[],
  roleCondition: string
): Director[] {
  if (roleCondition === "all") return [];
  if (roleCondition.startsWith("former_")) return [];
  const year = meetingYear(record);
  return directorsForRecord(record, directors)
    .filter((director) => directorMatchesRole(director, roleCondition));
}

function roleLabel(roleCondition: string) {
  return roleConditionLabels[roleCondition] ?? roleCondition;
}

function companyDetailHref(record: VoteRecord) {
  return `/companies/${record.company_code}?year=${meetingYear(record)}`;
}

function convocationNoticeUrl(record: VoteRecord) {
  return record.convocation_notice_url || "";
}

function meetingYear(record: VoteRecord) {
  // Handle formats like "定時20250826", "20250826", "2025-08-26"
  const match = String(record.meeting_date).match(/(\d{4})/);
  return match ? Number(match[1]) : 2025;
}

function recentMetrics(metrics: FinancialMetric[], companyCode: string, year: number, periods: number) {
  return metrics
    .filter((metric) => metric.company_code === companyCode && metric.fiscal_year <= year)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, periods)
    .reverse();
}

function latestGovernance(metrics: GovernanceMetric[], companyCode: string, year: number) {
  return metrics
    .filter((metric) => metric.company_code === companyCode && metric.meeting_year <= year)
    .sort((a, b) => b.meeting_year - a.meeting_year)[0];
}

function directorsForRecord(record: VoteRecord, directors: Director[]) {
  const year = meetingYear(record);
  return directors.filter((director) => director.company_code === record.company_code && director.meeting_year <= year);
}

function directorMatchesRole(director: Director, roleCondition: string) {
  if (roleCondition === "all") return true;
  if (roleCondition === "current_president_or_ceo") return director.is_president || director.is_ceo;
  if (roleCondition === "current_representative_chair") return director.is_chair && director.has_representative_authority;
  if (roleCondition === "current_board_chair") return director.is_board_chair;
  if (roleCondition === "current_inside_director") return director.is_inside_director;
  if (roleCondition === "current_outside_director") return director.is_outside_director;
  if (roleCondition === "current_independent_outside_director") return director.is_outside_director && director.is_independent;
  if (roleCondition === "current_female_director") return director.is_female;
  if (roleCondition === "current_female_outside_director") return director.is_female && director.is_outside_director;
  return false;
}

function historyMatchesRole(history: DirectorRoleHistory, roleCondition: string, year: number) {
  const endYear = history.end_year ?? year;
  const activeWithin3Years = history.start_year <= year && endYear >= year - 3;
  if (!activeWithin3Years) return false;
  if (roleCondition === "former_president_within_3_years") return history.role_type === "president" || history.role_type === "ceo";
  if (roleCondition === "former_representative_chair_within_3_years") return history.role_type === "chair" && history.has_representative_authority;
  return false;
}

function companyMatchesRole(record: VoteRecord, directors: Director[], roleHistory: DirectorRoleHistory[], roleCondition: string) {
  if (roleCondition === "all") return true;
  const year = meetingYear(record);
  // If no data registered for this company, skip the role filter (pass through)
  const companyDirectors = directors.filter((d) => d.company_code === record.company_code);
  const companyHistory = roleHistory.filter((h) => h.company_code === record.company_code);
  if (companyDirectors.length === 0 && companyHistory.length === 0) return true;
  if (roleCondition.startsWith("former_")) {
    return companyHistory.some((history) => historyMatchesRole(history, roleCondition, year));
  }
  return companyDirectors.filter((d) => d.meeting_year <= year).some((director) => directorMatchesRole(director, roleCondition));
}

function matchedDirectorNames(record: VoteRecord, directors: Director[], roleHistory: DirectorRoleHistory[], roleCondition: string) {
  if (roleCondition === "all") return [];
  const year = meetingYear(record);
  if (roleCondition.startsWith("former_")) {
    return roleHistory
      .filter((history) => history.company_code === record.company_code)
      .filter((history) => historyMatchesRole(history, roleCondition, year))
      .map((history) => `${history.name}（${history.role_title}、${history.start_year}-${history.end_year ?? "現任"}）`);
  }
  return directorsForRecord(record, directors)
    .filter((director) => directorMatchesRole(director, roleCondition))
    .map((director) => `${director.name}（${director.current_title}）`);
}

function compareValue(value: number | null | undefined, operator: Operator, thresholdText: string) {
  if (operator === "none" || thresholdText.trim() === "") return true;
  if (value === null || value === undefined || Number.isNaN(value)) return false;
  const threshold = Number(thresholdText);
  if (!Number.isFinite(threshold)) return true;
  if (operator === "below") return value < threshold;
  if (operator === "below_or_equal") return value <= threshold;
  if (operator === "above") return value > threshold;
  if (operator === "above_or_equal") return value >= threshold;
  return true;
}

function metricValuesForRecord(
  record: VoteRecord,
  financialMetrics: FinancialMetric[],
  governanceMetrics: GovernanceMetric[],
  directors: Director[],
  metricKey: MetricKey,
  periods: number
) {
  const year = meetingYear(record);
  if (metricKey === "none") return [];
  if (metricKey === "roe" || metricKey === "pbr" || metricKey === "tsr_3y_rank_percentile") {
    return recentMetrics(financialMetrics, record.company_code, year, periods).map((metric) => ({
      label: String(metric.fiscal_year),
      value: metric[metricKey] ?? null,
      sourceUrl: metric.source_url,
      notes: metric.notes,
    }));
  }
  if (metricKey === "policy_shareholdings_ratio" || metricKey === "independent_director_ratio" || metricKey === "female_director_ratio") {
    const metric = latestGovernance(governanceMetrics, record.company_code, year);
    return metric
      ? [{ label: String(metric.meeting_year), value: metric[metricKey], sourceUrl: metric.source_url, notes: metric.notes }]
      : [];
  }
  return directorsForRecord(record, directors).map((director) => {
    const valueMap: Record<string, number | null | undefined> = {
      tenure_before: director.tenure_years_before_meeting,
      tenure_after: director.tenure_years_after_reelection,
      board_attendance_rate: director.board_attendance_rate,
      outside_board_seats: director.outside_board_seats,
      listed_company_board_seats: director.listed_company_board_seats,
    };
    return {
      label: director.name,
      value: valueMap[metricKey],
      sourceUrl: "",
      notes: director.current_title,
    };
  });
}

function metricConditionMatches(
  record: VoteRecord,
  financialMetrics: FinancialMetric[],
  governanceMetrics: GovernanceMetric[],
  directors: Director[],
  condition: SavedCondition
) {
  if (condition.metricKey === "none" || condition.metricOperator === "none") return true;
  const periods = Math.max(1, Number(condition.metricPeriods) || 1);
  const values = metricValuesForRecord(record, financialMetrics, governanceMetrics, directors, condition.metricKey, periods);
  // When no metric data is registered for the company, skip the metric filter (pass through)
  // This allows 行使結果データのある全企業を表示しつつ、登録済み財務データ保有企業のみ数値条件を適用する
  if (values.length === 0) return true;
  if (condition.metricKey === "roe" || condition.metricKey === "pbr" || condition.metricKey === "tsr_3y_rank_percentile") {
    return values.length >= periods && values.every((item) => compareValue(item.value, condition.metricOperator, condition.metricThreshold));
  }
  return values.some((item) => compareValue(item.value, condition.metricOperator, condition.metricThreshold));
}

function matchesCondition(
  record: VoteRecord,
  financialMetrics: FinancialMetric[],
  governanceMetrics: GovernanceMetric[],
  directors: Director[],
  roleHistory: DirectorRoleHistory[],
  condition: SavedCondition
) {
  if (condition.vote !== "all" && record.vote !== condition.vote) return false;
  if (condition.issueType !== "all" && record.issue_type !== condition.issueType) return false;
  if (condition.detailTag !== "all" && !(record.detail_tags ?? []).includes(condition.detailTag)) return false;
  if (!companyMatchesRole(record, directors, roleHistory, condition.roleCondition)) return false;

  const keyword = condition.keyword.trim().toLowerCase();
  if (keyword) {
    const text = `${record.company_code} ${record.company_name} ${record.proposal_type} ${record.director_or_role} ${record.target_label ?? ""} ${record.match_method ?? ""} ${record.matched_director_name ?? ""} ${record.matched_director_title ?? ""} ${(record.matched_director_attributes ?? []).join(" ")} ${record.reason} ${(record.detail_tags ?? []).join(" ")}`.toLowerCase();
    // スペース区切りで複数キーワードのOR検索（いずれか1語が含まれれば通過）
    const words = keyword.split(/\s+/).filter(Boolean);
    if (!words.some((word) => text.includes(word))) return false;
  }

  return metricConditionMatches(record, financialMetrics, governanceMetrics, directors, condition);
}

function normalizeCondition(condition: Partial<SavedCondition> | null | undefined): SavedCondition {
  return {
    id: condition?.id ?? `condition_${Date.now()}`,
    name: condition?.name ?? "BlackRock 責任取締役仮説",
    vote: condition?.vote ?? "反対",
    issueType: condition?.issueType ?? "low_roe",
    detailTag: condition?.detailTag ?? "all",
    roleCondition: condition?.roleCondition ?? "current_president_or_ceo",
    keyword: condition?.keyword ?? "",
    metricKey: condition?.metricKey ?? "roe",
    metricOperator: condition?.metricOperator ?? "below",
    metricThreshold: condition?.metricThreshold ?? (condition as { roeBelow?: string } | undefined)?.roeBelow ?? "5",
    metricPeriods: condition?.metricPeriods ?? "3",
  };
}

function csvEscape(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadAnalysisCsv(rows: VoteRecord[], investorId: string, filePrefix: string) {
  const headers = [
    "投資家ID",
    "企業コード",
    "企業名",
    "総会日",
    "行使",
    "議案",
    "候補者番号",
    "反対対象候補",
    "対象推定方法",
    "対象推定信頼度",
    "照合候補者名",
    "照合候補者肩書",
    "候補者属性",
    "候補者照合方法",
    "候補者照合信頼度",
    "候補者/役割",
    "推定論点",
    "詳細条件",
    "理由",
    "出典URL",
    "招集通知URL",
  ];
  const body = rows.map((row) =>
    [
      row.investor_id,
      row.company_code,
      row.company_name,
      row.meeting_date,
      row.vote,
      row.proposal_type,
      row.candidate_number ?? "",
      row.target_label ?? "",
      row.match_method ?? "",
      row.target_confidence ?? "",
      row.matched_director_name ?? "",
      row.matched_director_title ?? "",
      (row.matched_director_attributes ?? []).join(" / "),
      row.director_match_method ?? "",
      row.director_match_confidence ?? "",
      row.director_or_role,
      issueLabel(row.issue_type),
      (row.detail_tags ?? []).join(" / "),
      row.reason,
      row.source_url,
      convocationNoticeUrl(row),
    ].map(csvEscape).join(",")
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filePrefix}_${investorId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function metricValueText(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(1)}${suffix}`;
}

export function InvestorAnalysisWorkspace({ investorId, records, financialMetrics, governanceMetrics, directors, roleHistory }: Props) {
  const [tab, setTab] = useState<"list" | "conditions" | "boundary">("list");
  const [draft, setDraft] = useState<SavedCondition>(() => normalizeCondition(null));
  const [conditions, setConditions] = useState<SavedCondition[]>([]);
  const [boundaryMetric, setBoundaryMetric] = useState<MetricKey>("roe");
  const [boundaryIssue, setBoundaryIssue] = useState("all");
  const [boundaryVote, setBoundaryVote] = useState<VoteFilter>("all");

  const investorRecords = useMemo(
    () => records.filter((record) => record.investor_id === investorId),
    [records, investorId]
  );
  const issueTypes = useMemo(
    () => [...new Set(investorRecords.map((record) => record.issue_type))].sort(),
    [investorRecords]
  );
  const detailTags = useMemo(
    () => [...new Set(investorRecords.flatMap((record) => record.detail_tags ?? []))].sort(),
    [investorRecords]
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(`analysis_conditions_${investorId}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SavedCondition>[];
      setConditions(parsed.map(normalizeCondition));
    } catch {
      setConditions([]);
    }
  }, [investorId]);

  function saveCondition() {
    const next = [...conditions, { ...draft, id: `condition_${Date.now()}` }];
    setConditions(next);
    window.localStorage.setItem(`analysis_conditions_${investorId}`, JSON.stringify(next));
  }

  function clearDraftCondition() {
    setDraft(normalizeCondition({ name: "", vote: "all", issueType: "all", roleCondition: "all", metricKey: "none", metricOperator: "none", metricThreshold: "", metricPeriods: "1" }));
  }

  function deleteCondition(id: string) {
    const next = conditions.filter((condition) => condition.id !== id);
    setConditions(next);
    window.localStorage.setItem(`analysis_conditions_${investorId}`, JSON.stringify(next));
  }

  const previewRows = useMemo(
    () => investorRecords.filter((record) => matchesCondition(record, financialMetrics, governanceMetrics, directors, roleHistory, draft)),
    [directors, draft, financialMetrics, governanceMetrics, investorRecords, roleHistory]
  );

  const boundaryRows = useMemo(() => {
    const unique = new Map<string, VoteRecord>();
    for (const record of investorRecords) {
      if (boundaryVote !== "all" && record.vote !== boundaryVote) continue;
      if (boundaryIssue !== "all" && record.issue_type !== boundaryIssue) continue;
      const key = `${record.company_code}-${record.vote}-${record.issue_type}-${record.proposal_type}`;
      if (!unique.has(key)) unique.set(key, record);
    }

    return [...unique.values()]
      .map((record) => ({
        record,
        values: metricValuesForRecord(record, financialMetrics, governanceMetrics, directors, boundaryMetric, boundaryMetric === "roe" ? 3 : 1),
      }))
      .sort((a, b) => {
        const av = Math.max(...a.values.map((item) => item.value ?? Number.NEGATIVE_INFINITY));
        const bv = Math.max(...b.values.map((item) => item.value ?? Number.NEGATIVE_INFINITY));
        return av - bv || a.record.company_code.localeCompare(b.record.company_code);
      });
  }, [boundaryIssue, boundaryMetric, boundaryVote, directors, financialMetrics, governanceMetrics, investorRecords]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            ["list", "行使先一覧"],
            ["conditions", "詳細条件分析"],
            ["boundary", "ボーダー分析"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as "list" | "conditions" | "boundary")}
              className={`rounded px-4 py-2 text-sm ${tab === key ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "list" && <InvestorOppositionTable investorId={investorId} records={records} />}

      {tab === "conditions" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">詳細条件分析</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                操作者側で仮説条件を作成し、下の一覧で該当先を確認します。例: 3期連続ROE5%未満、過去3年以内の社長経験者、任期12年超など。
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadAnalysisCsv(previewRows, investorId, "詳細条件分析")}
              className="rounded border bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              CSV出力
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input className="rounded border px-3 py-2 text-sm" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="条件名" />
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.vote} onChange={(event) => setDraft({ ...draft, vote: event.target.value as VoteFilter })}>
              <option value="反対">反対</option>
              <option value="賛成">賛成</option>
              <option value="all">両方</option>
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.issueType} onChange={(event) => setDraft({ ...draft, issueType: event.target.value })}>
              <option value="all">すべての論点</option>
              {issueTypes.map((issue) => <option key={issue} value={issue}>{issueLabel(issue)}</option>)}
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.detailTag} onChange={(event) => setDraft({ ...draft, detailTag: event.target.value })}>
              <option value="all">すべての詳細条件</option>
              {detailTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.roleCondition} onChange={(event) => setDraft({ ...draft, roleCondition: event.target.value })}>
              {Object.entries(roleConditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.metricKey} onChange={(event) => setDraft({ ...draft, metricKey: event.target.value as MetricKey })}>
              {Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.metricOperator} onChange={(event) => setDraft({ ...draft, metricOperator: event.target.value as Operator })}>
              {Object.entries(operatorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="rounded border px-3 py-2 text-sm" value={draft.metricThreshold} onChange={(event) => setDraft({ ...draft, metricThreshold: event.target.value })} placeholder="閾値: 5 / 1 / 12" />
            <input className="rounded border px-3 py-2 text-sm" value={draft.metricPeriods} onChange={(event) => setDraft({ ...draft, metricPeriods: event.target.value })} placeholder="連続年数: 3" />
            <input className="rounded border px-3 py-2 text-sm md:col-span-3" value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} placeholder="キーワード（スペース区切りでOR検索）: 社長 会長 経営責任者 報酬" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={saveCondition} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
              条件を保存
            </button>
            <button
              type="button"
              onClick={clearDraftCondition}
              className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              条件クリア
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, metricKey: "tenure_after", metricOperator: "above", metricThreshold: "12", metricPeriods: "1", issueType: "tenure", keyword: "" })}
              className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              任期13年目仮説
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, metricKey: "tenure_before", metricOperator: "above_or_equal", metricThreshold: "12", metricPeriods: "1", issueType: "tenure", keyword: "" })}
              className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              任期12年満了仮説
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded bg-slate-50 p-3"><p className="text-xs text-slate-500">該当</p><p className="text-2xl font-bold">{previewRows.length.toLocaleString()}</p></div>
            <div className="rounded bg-red-50 p-3"><p className="text-xs text-red-700">反対</p><p className="text-2xl font-bold text-red-700">{previewRows.filter((row) => row.vote === "反対").length.toLocaleString()}</p></div>
            <div className="rounded bg-green-50 p-3"><p className="text-xs text-green-700">賛成</p><p className="text-2xl font-bold text-green-700">{previewRows.filter((row) => row.vote === "賛成").length.toLocaleString()}</p></div>
            <div className="rounded bg-amber-50 p-3"><p className="text-xs text-amber-700">反対比率</p><p className="text-2xl font-bold text-amber-700">{previewRows.length ? Math.round((previewRows.filter((row) => row.vote === "反対").length / previewRows.length) * 100) : 0}%</p></div>
          </div>
          <p className="mt-2 rounded bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
            財務・役員データが登録されている企業（約25社）は数値条件が適用されます。未登録企業は論点・行使区分のみで絞り込まれ、条件値欄は「-」で表示されます。
          </p>

          <div className="mt-5 overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">企業</th>
                  <th className="px-3 py-2 text-left">総会日</th>
                  <th className="px-3 py-2 text-left">行使</th>
                  <th className="px-3 py-2 text-left">論点</th>
                  <th className="px-3 py-2 text-left">対象候補・属性</th>
                  <th className="px-3 py-2 text-left">条件値</th>
                  <th className="px-3 py-2 text-left">理由</th>
                  <th className="px-3 py-2 text-left">出典</th>
                  <th className="px-3 py-2 text-left">招集通知</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm leading-6 text-slate-500">
                      この条件に該当する行使結果はありません。論点・行使区分を「すべて」に変更するか、財務・在任条件を外してお試しください。
                    </td>
                  </tr>
                )}
                {previewRows.slice(0, 200).map((record, index) => {
                  const values = metricValuesForRecord(record, financialMetrics, governanceMetrics, directors, draft.metricKey, Number(draft.metricPeriods) || 1);
                  const matchedDirObjects = matchedDirectorObjectsFull(record, directors, roleHistory, draft.roleCondition);
                  const historicalNames = draft.roleCondition.startsWith("former_")
                    ? matchedDirectorNames(record, directors, roleHistory, draft.roleCondition)
                    : [];
                  return (
                    <tr key={`${record.company_code}-${record.meeting_date}-${record.proposal_number}-${index}`} className="align-top">
                      <td className="px-3 py-2">
                        <Link href={companyDetailHref(record)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                          {record.company_name || record.company_code}
                        </Link>
                        <p className="text-slate-500">{record.company_code}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{record.meeting_date ? record.meeting_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1/$2/$3") : "-"}</td>
                      <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 font-semibold ${record.vote === "反対" ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"}`}>{record.vote}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap">{issueLabel(record.issue_type)}</td>
                      <td className="max-w-xs px-3 py-2 text-slate-600">
                        <p className="text-xs font-semibold text-slate-700">{record.target_label || "-"}</p>

                        {/* Directors matched from opposition record data */}
                        {record.matched_director_name && (
                          <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <p className="text-xs font-semibold text-slate-900">{record.matched_director_name}</p>
                            {record.matched_director_title && <p className="text-[11px] text-slate-500">{record.matched_director_title}</p>}
                            {(record.matched_director_attributes ?? []).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {record.matched_director_attributes?.map((tag) => (
                                  <span key={tag} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Directors matched from local directors data via role condition */}
                        {matchedDirObjects.map((dir) => {
                          const attrTags = getDirectorAttributeTags(dir);
                          return (
                            <div key={dir.director_id ?? dir.name} className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                              <p className="text-xs font-semibold text-slate-900">{dir.name}</p>
                              <p className="text-[11px] text-slate-500">{dir.current_title}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {attrTags.map((tag) => (
                                  <span key={tag.label} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tag.color}`}>
                                    {tag.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                        {/* Historical role matches (former president/chair etc.) */}
                        {historicalNames.length > 0 && (
                          <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1">
                            {historicalNames.map((n) => (
                              <p key={n} className="text-[11px] text-amber-800">{n}</p>
                            ))}
                          </div>
                        )}

                        <p className="mt-1 text-[10px] text-slate-400">{record.match_method || "未特定"} / {record.target_confidence || "Low"}</p>
                      </td>
                      <td className="max-w-xs px-3 py-2 text-slate-600 whitespace-nowrap">{values.length ? values.map((item) => `${item.label}: ${metricValueText(item.value, draft.metricKey.includes("ratio") || draft.metricKey.includes("rate") || draft.metricKey === "roe" ? "%" : "")}`).join(" / ") : "-"}</td>
                      <td className="max-w-md px-3 py-2 text-xs leading-5 text-slate-700">{record.reason || <span className="text-slate-400">理由記載なし</span>}</td>
                      <td className="px-3 py-2">{record.source_url ? <a className="text-blue-700 hover:underline" href={record.source_url} target="_blank" rel="noreferrer">開く</a> : "-"}</td>
                      <td className="px-3 py-2">
                        {convocationNoticeUrl(record) ? (
                          <a className="text-emerald-700 hover:underline" href={convocationNoticeUrl(record)} target="_blank" rel="noreferrer" title="登録済み招集通知">開く</a>
                        ) : (
                          <span className="text-slate-400">未登録</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {conditions.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="text-sm font-bold">保存済み条件</h3>
              {conditions.map((condition) => {
                const matched = investorRecords.filter((record) => matchesCondition(record, financialMetrics, governanceMetrics, directors, roleHistory, condition));
                return (
                  <div key={condition.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                    <button type="button" onClick={() => setDraft(condition)} className="text-left font-semibold text-blue-700 hover:underline">{condition.name}</button>
                    <span className="text-xs text-slate-500">{issueLabel(condition.issueType)} / {metricLabels[condition.metricKey]} {operatorLabels[condition.metricOperator]} {condition.metricThreshold} / {matched.length.toLocaleString()}件</span>
                    <button type="button" onClick={() => deleteCondition(condition.id)} className="rounded border px-3 py-1 text-xs text-slate-600">削除</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "boundary" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">ボーダー分析</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                ROEに限らず、PBR、政策保有株式、取締役会構成、任期、出席率、兼職数などを賛否結果と横並びで確認します。
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadAnalysisCsv(boundaryRows.map((row) => row.record), investorId, "ボーダー分析")}
              className="rounded border bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              CSV出力
            </button>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <select className="rounded border bg-white px-3 py-2 text-sm" value={boundaryMetric} onChange={(event) => setBoundaryMetric(event.target.value as MetricKey)}>
              {Object.entries(metricLabels).filter(([value]) => value !== "none").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={boundaryVote} onChange={(event) => setBoundaryVote(event.target.value as VoteFilter)}>
              <option value="all">両方表示</option>
              <option value="反対">反対のみ</option>
              <option value="賛成">賛成のみ</option>
            </select>
            <select className="rounded border bg-white px-3 py-2 text-sm" value={boundaryIssue} onChange={(event) => setBoundaryIssue(event.target.value)}>
              <option value="all">すべての論点</option>
              {issueTypes.map((issue) => <option key={issue} value={issue}>{issueLabel(issue)}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">企業</th>
                  <th className="px-3 py-2 text-left">総会日</th>
                  <th className="px-3 py-2 text-left">行使</th>
                  <th className="px-3 py-2 text-left">論点</th>
                  <th className="px-3 py-2 text-left">分析値</th>
                  <th className="px-3 py-2 text-left">理由・考察</th>
                  <th className="px-3 py-2 text-left">エビデンス</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {boundaryRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm leading-6 text-slate-500">
                      表示できる行使結果がまだありません。投資家の行使結果データを取り込むと、選択した指標と賛否を横並びで確認できます。
                    </td>
                  </tr>
                )}
                {boundaryRows.slice(0, 300).map(({ record, values }, index) => {
                  const visibleValues = values.slice(0, 4);
                  const hasEvidence = values.find((item) => item.sourceUrl);
                  return (
                    <tr key={`${record.company_code}-${record.vote}-${record.issue_type}-${index}`} className="align-top">
                      <td className="px-3 py-2">
                        <Link href={companyDetailHref(record)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                          {record.company_name || record.company_code}
                        </Link>
                        <p className="text-slate-500">{record.company_code}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{record.meeting_date}</td>
                      <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 font-semibold ${record.vote === "反対" ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"}`}>{record.vote}</span></td>
                      <td className="px-3 py-2">{issueLabel(record.issue_type)}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {visibleValues.length ? visibleValues.map((item) => (
                          <p key={`${record.company_code}-${item.label}`}>{item.label}: {metricValueText(item.value, boundaryMetric.includes("ratio") || boundaryMetric.includes("rate") || boundaryMetric === "roe" ? "%" : "")}</p>
                        )) : "-"}
                      </td>
                      <td className="max-w-md px-3 py-2 text-slate-700">
                        {record.reason ? (
                          <p className="text-xs leading-5">{record.reason}</p>
                        ) : (
                          <span className="text-xs text-slate-400">{record.vote === "反対" ? "反対理由記載なし" : "賛成理由記載なし"}</span>
                        )}
                        <p className="mt-1 text-xs leading-4 text-slate-400">
                          {record.vote === "反対"
                            ? `${metricLabels[boundaryMetric]}との照合で、投資家がどの水準を問題視したか確認します。`
                            : "抵触していても賛成の場合は、改善方針・例外規定・定性判断・対象者の違いを確認します。"}
                        </p>
                      </td>
                      <td className="px-3 py-2">{hasEvidence?.sourceUrl ? <a className="text-blue-700 hover:underline" href={hasEvidence.sourceUrl} target="_blank" rel="noreferrer">開く</a> : <span className="text-slate-400">未登録</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {boundaryRows.length > 300 && <p className="mt-2 text-xs text-slate-500">画面表示は先頭300件です。CSVには絞り込み後の全件を出力します。</p>}
        </section>
      )}
    </section>
  );
}
