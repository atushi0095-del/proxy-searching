"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InvestorOppositionTable } from "@/components/InvestorOppositionTable";

interface MetricValue {
  label: string;
  value: number | null;
  sourceUrl: string;
  notes: string;
}

interface DirectorRef {
  director_id?: string;
  name: string;
  current_title: string;
  is_inside_director?: boolean;
  is_outside_director?: boolean;
  is_independent?: boolean;
  is_president?: boolean;
  is_ceo?: boolean;
  is_chair?: boolean;
  has_representative_authority?: boolean;
  is_board_chair?: boolean;
  tenure_years_before_meeting?: number;
  is_female?: boolean;
}

interface AnalysisRow {
  id: number;
  investor_id: string;
  company_code: string;
  company_name: string;
  meeting_date: string;
  meeting_year: number;
  proposal_number: string;
  resolution_number?: string | null;
  candidate_number?: string | null;
  proposal_type: string;
  director_or_role: string;
  vote: string;
  issue_type: string;
  detail_tags: string[];
  target_label?: string | null;
  match_method?: string | null;
  target_confidence?: string | null;
  matched_director_name?: string | null;
  matched_director_title?: string | null;
  matched_director_attributes: string[];
  reason: string;
  source_url: string;
  convocation_notice_url?: string | null;
  metric_values: MetricValue[];
  matched_directors: { name: string; title: string; director: DirectorRef }[];
  historical_names: string[];
  is_direct_match: boolean;
}

interface ConditionResponse {
  rows: AnalysisRow[];
  totalMatched: number;
  matchedAgainst: number;
  matchedFor: number;
  displayTotal: number;
  displayAgainst: number;
  displayFor: number;
  matchedCompanyCount: number;
}

interface BoundaryResponse {
  rows: { record: AnalysisRow; values: MetricValue[] }[];
  total: number;
}

interface Facets {
  issueTypes: string[];
  detailTags: string[];
  meetingYears: string[];
  summary: { total: number; againstCount: number; forCount: number; forWithReasonCount: number };
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

function getDirectorAttributeTags(director: DirectorRef): { label: string; color: string }[] {
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

function companyDetailHref(record: AnalysisRow) {
  return `/companies/${record.company_code}?year=${record.meeting_year}`;
}

function convocationNoticeUrl(record: AnalysisRow) {
  return record.convocation_notice_url || "";
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

function conditionQueryString(condition: SavedCondition, expand: boolean): string {
  const params = new URLSearchParams({
    mode: "conditions",
    vote: condition.vote,
    issueType: condition.issueType,
    detailTag: condition.detailTag,
    role: condition.roleCondition,
    metricKey: condition.metricKey,
    metricOp: condition.metricOperator,
    metricThreshold: condition.metricThreshold,
    metricPeriods: condition.metricPeriods,
    expand: expand ? "1" : "0",
  });
  if (condition.keyword.trim()) params.set("q", condition.keyword.trim());
  return params.toString();
}

function metricValueText(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(1)}${suffix}`;
}

export function InvestorAnalysisWorkspace({ investorId }: Props) {
  const [tab, setTab] = useState<"list" | "conditions" | "boundary">("list");
  const [draft, setDraft] = useState<SavedCondition>(() => normalizeCondition(null));
  const [conditions, setConditions] = useState<SavedCondition[]>([]);
  const [conditionCounts, setConditionCounts] = useState<Record<string, number>>({});
  const [showAllCompanyProposals, setShowAllCompanyProposals] = useState(false);
  const [boundaryMetric, setBoundaryMetric] = useState<MetricKey>("roe");
  const [boundaryIssue, setBoundaryIssue] = useState("all");
  const [boundaryVote, setBoundaryVote] = useState<VoteFilter>("all");

  const [facets, setFacets] = useState<Facets | null>(null);
  const [conditionResult, setConditionResult] = useState<ConditionResponse | null>(null);
  const [conditionLoading, setConditionLoading] = useState(false);
  const [boundaryResult, setBoundaryResult] = useState<BoundaryResponse | null>(null);

  const issueTypes = facets?.issueTypes ?? [];
  const detailTags = facets?.detailTags ?? [];

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/investors/${investorId}/analysis?mode=facets`, { signal: controller.signal })
      .then((res) => res.json())
      .then(setFacets)
      .catch(() => {});
    return () => controller.abort();
  }, [investorId]);

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

  // 詳細条件分析: 条件が変わったらサーバー側でフィルタして表示分だけ取得
  const conditionsQuery = useMemo(() => conditionQueryString(draft, showAllCompanyProposals), [draft, showAllCompanyProposals]);
  useEffect(() => {
    if (tab !== "conditions") return;
    const controller = new AbortController();
    setConditionLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/investors/${investorId}/analysis?${conditionsQuery}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: ConditionResponse) => {
          setConditionResult(data);
          setConditionLoading(false);
        })
        .catch(() => {});
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [investorId, conditionsQuery, tab]);

  // 保存済み条件の該当件数（軽量な countOnly リクエスト）
  useEffect(() => {
    if (tab !== "conditions" || conditions.length === 0) return;
    const controller = new AbortController();
    for (const condition of conditions) {
      fetch(`/api/investors/${investorId}/analysis?${conditionQueryString(condition, false)}&countOnly=1`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { totalMatched: number }) => {
          setConditionCounts((prev) => ({ ...prev, [condition.id]: data.totalMatched }));
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [investorId, conditions, tab]);

  // ボーダー分析
  useEffect(() => {
    if (tab !== "boundary") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ mode: "boundary", metric: boundaryMetric, vote: boundaryVote, issueType: boundaryIssue });
    fetch(`/api/investors/${investorId}/analysis?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then(setBoundaryResult)
      .catch(() => {});
    return () => controller.abort();
  }, [investorId, boundaryMetric, boundaryVote, boundaryIssue, tab]);

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

  function downloadConditionsCsv() {
    window.location.href = `/api/investors/${investorId}/analysis?${conditionsQuery}&format=csv`;
  }

  function downloadBoundaryCsv() {
    const params = new URLSearchParams({ mode: "boundary", metric: boundaryMetric, vote: boundaryVote, issueType: boundaryIssue, format: "csv" });
    window.location.href = `/api/investors/${investorId}/analysis?${params}`;
  }

  const analysisRows = conditionResult?.rows ?? [];
  const boundaryRows = boundaryResult?.rows ?? [];

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

      {tab === "list" && <InvestorOppositionTable investorId={investorId} />}

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
              onClick={downloadConditionsCsv}
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
            {/* 全議案展開トグル */}
            <button
              type="button"
              onClick={() => setShowAllCompanyProposals((v) => !v)}
              className={`rounded border px-4 py-2 text-sm transition ${
                showAllCompanyProposals
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {showAllCompanyProposals ? "▼ 条件企業の全議案 表示中" : "▼ 条件企業の全議案を展開"}
            </button>
          </div>

          {/* 展開モードバナー */}
          {showAllCompanyProposals && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-bold text-blue-900">条件企業の全議案を表示中</p>
              <p className="mt-0.5 text-xs leading-5 text-blue-800">
                条件に該当した <strong>{conditionResult?.matchedCompanyCount ?? 0}社</strong> の全議案（賛否問わず）を表示しています。
                同一企業で「誰に反対し誰に賛成したか」を横断確認できます。
                <span className="ml-2 rounded bg-blue-200 px-1.5 py-0.5 text-[11px] text-blue-900 font-semibold">条件該当</span> バッジが条件に一致した行です。
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{showAllCompanyProposals ? "表示（全議案）" : "条件該当"}</p>
              <p className="text-2xl font-bold">{conditionLoading ? "…" : (conditionResult?.displayTotal ?? 0).toLocaleString()}</p>
              {showAllCompanyProposals && <p className="text-[11px] text-slate-500">うち条件一致 {(conditionResult?.totalMatched ?? 0).toLocaleString()}件</p>}
            </div>
            <div className="rounded bg-red-50 p-3"><p className="text-xs text-red-700">反対</p><p className="text-2xl font-bold text-red-700">{(conditionResult?.displayAgainst ?? 0).toLocaleString()}</p></div>
            <div className="rounded bg-green-50 p-3"><p className="text-xs text-green-700">賛成</p><p className="text-2xl font-bold text-green-700">{(conditionResult?.displayFor ?? 0).toLocaleString()}</p></div>
            <div className="rounded bg-amber-50 p-3"><p className="text-xs text-amber-700">反対比率</p><p className="text-2xl font-bold text-amber-700">{conditionResult?.displayTotal ? Math.round(((conditionResult?.displayAgainst ?? 0) / conditionResult.displayTotal) * 100) : 0}%</p></div>
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
                  <th className="px-3 py-2 text-left">議案</th>
                  <th className="px-3 py-2 text-left">候補者・属性</th>
                  <th className="px-3 py-2 text-left">条件値</th>
                  <th className="px-3 py-2 text-left">理由</th>
                  <th className="px-3 py-2 text-left">出典</th>
                  <th className="px-3 py-2 text-left">招集通知</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analysisRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-sm leading-6 text-slate-500">
                      {conditionLoading ? "検索中..." : "この条件に該当する行使結果はありません。論点・行使区分を「すべて」に変更するか、財務・在任条件を外してお試しください。"}
                    </td>
                  </tr>
                )}
                {analysisRows.map((record, index) => {
                  const isDirectMatch = record.is_direct_match;
                  const values = record.metric_values;
                  return (
                    <tr
                      key={`${record.company_code}-${record.meeting_date}-${record.proposal_number}-${index}`}
                      className={`align-top ${showAllCompanyProposals && !isDirectMatch ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <Link href={companyDetailHref(record)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                          {record.company_name || record.company_code}
                        </Link>
                        <p className="text-slate-500">{record.company_code}</p>
                        {showAllCompanyProposals && (
                          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            isDirectMatch ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
                          }`}>
                            {isDirectMatch ? "条件該当" : "同一企業・他議案"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{record.meeting_date ? record.meeting_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1/$2/$3") : "-"}</td>
                      <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 font-semibold ${record.vote === "反対" ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"}`}>{record.vote}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap">{issueLabel(record.issue_type)}</td>
                      {/* 議案列 */}
                      <td className="px-3 py-2 text-slate-600 max-w-[180px]">
                        <p className="truncate text-xs">{record.proposal_type || "-"}</p>
                        <p className="text-[11px] text-slate-400">
                          {record.resolution_number || record.proposal_number ? `議案${record.resolution_number || record.proposal_number}` : ""}
                          {record.candidate_number ? `-${record.candidate_number}` : ""}
                        </p>
                      </td>
                      {/* 候補者・属性列 */}
                      <td className="px-3 py-2 max-w-[200px]">
                        {/* opposition recordから照合済み候補者 */}
                        {record.matched_director_name && (
                          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <p className="text-xs font-semibold text-slate-900">{record.matched_director_name}</p>
                            {record.matched_director_title && <p className="text-[11px] text-slate-500">{record.matched_director_title}</p>}
                            {record.matched_director_attributes.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {record.matched_director_attributes.map((tag) => (
                                  <span key={tag} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{tag}</span>
                                ))}
                              </div>
                            )}
                            <p className="mt-1 text-[10px] text-slate-400">{record.match_method || "未特定"} / {record.target_confidence || "Low"}</p>
                          </div>
                        )}
                        {/* ロール条件で照合したローカル取締役データ */}
                        {record.matched_directors.map(({ director }) => {
                          const attrTags = getDirectorAttributeTags(director);
                          return (
                            <div key={director.director_id ?? director.name} className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                              <p className="text-xs font-semibold text-slate-900">{director.name}</p>
                              <p className="text-[11px] text-slate-500">{director.current_title}</p>
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
                        {/* 元役職（過去3年以内の社長等） */}
                        {record.historical_names.length > 0 && (
                          <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1">
                            {record.historical_names.map((n) => (
                              <p key={n} className="text-[11px] text-amber-800">{n}</p>
                            ))}
                          </div>
                        )}
                        {!record.matched_director_name && record.matched_directors.length === 0 && record.historical_names.length === 0 && (
                          <span className="text-[11px] text-slate-300">未特定</span>
                        )}
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

          {(conditionResult?.displayTotal ?? 0) > analysisRows.length && (
            <p className="mt-2 text-xs text-slate-500">
              画面表示は先頭300件です。CSVには全{(conditionResult?.displayTotal ?? 0).toLocaleString()}件（上限5万件）を出力します。
            </p>
          )}

          {conditions.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="text-sm font-bold">保存済み条件</h3>
              {conditions.map((condition) => (
                <div key={condition.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <button type="button" onClick={() => setDraft(condition)} className="text-left font-semibold text-blue-700 hover:underline">{condition.name}</button>
                  <span className="text-xs text-slate-500">
                    {issueLabel(condition.issueType)} / {metricLabels[condition.metricKey]} {operatorLabels[condition.metricOperator]} {condition.metricThreshold} / {conditionCounts[condition.id] != null ? `${conditionCounts[condition.id].toLocaleString()}件` : "…"}
                  </span>
                  <button type="button" onClick={() => deleteCondition(condition.id)} className="rounded border px-3 py-1 text-xs text-slate-600">削除</button>
                </div>
              ))}
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
              onClick={downloadBoundaryCsv}
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
                {boundaryRows.map(({ record, values }, index) => {
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
          {(boundaryResult?.total ?? 0) > boundaryRows.length && <p className="mt-2 text-xs text-slate-500">画面表示は先頭300件です。CSVには絞り込み後の全件を出力します。</p>}
        </section>
      )}
    </section>
  );
}
