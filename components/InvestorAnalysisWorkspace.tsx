"use client";

import { useEffect, useMemo, useState } from "react";
import { InvestorOppositionTable } from "@/components/InvestorOppositionTable";

interface VoteRecord {
  investor_id: string;
  company_code: string;
  company_name: string;
  meeting_date: string;
  proposal_number: string;
  proposal_type: string;
  director_or_role: string;
  vote: string;
  issue_type: string;
  detail_tags?: string[];
  reason: string;
  source_url: string;
  source_title: string;
}

interface FinancialMetric {
  company_code: string;
  fiscal_year: number;
  roe: number | null;
  pbr: number | null;
  source_url: string;
  notes: string;
}

interface SavedCondition {
  id: string;
  name: string;
  vote: "all" | "反対" | "賛成";
  issueType: string;
  detailTag: string;
  keyword: string;
  roeBelow: string;
}

interface Props {
  investorId: string;
  records: VoteRecord[];
  financialMetrics: FinancialMetric[];
}

const issueLabels: Record<string, string> = {
  attendance: "出席率",
  board_independence: "取締役会独立性",
  compensation: "役員報酬",
  gender_diversity: "女性・ジェンダー",
  independence_failure: "独立性欠如",
  low_pbr: "PBR",
  low_roe: "ROE・資本効率",
  low_tsr: "TSR・株価",
  overboarding: "兼職数",
  policy_shareholdings: "政策保有株式",
  shareholder_proposal: "株主提案",
  takeover_defense: "買収防衛策",
  tenure: "在任期間",
  other: "その他",
};

function issueLabel(issue: string) {
  return issueLabels[issue] ?? issue;
}

function recentMetrics(metrics: FinancialMetric[], companyCode: string, meetingDate: string) {
  const meetingYear = Number(String(meetingDate).slice(0, 4)) || Math.max(...metrics.map((metric) => metric.fiscal_year), 2025);
  return metrics
    .filter((metric) => metric.company_code === companyCode && metric.fiscal_year <= meetingYear)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 3)
    .reverse();
}

function matchesCondition(record: VoteRecord, metrics: FinancialMetric[], condition: SavedCondition) {
  if (condition.vote !== "all" && record.vote !== condition.vote) return false;
  if (condition.issueType !== "all" && record.issue_type !== condition.issueType) return false;
  if (condition.detailTag !== "all" && !(record.detail_tags ?? []).includes(condition.detailTag)) return false;

  const keyword = condition.keyword.trim().toLowerCase();
  if (keyword) {
    const text = `${record.company_code} ${record.company_name} ${record.proposal_type} ${record.director_or_role} ${record.reason} ${(record.detail_tags ?? []).join(" ")}`.toLowerCase();
    if (!text.includes(keyword)) return false;
  }

  if (condition.roeBelow.trim()) {
    const threshold = Number(condition.roeBelow);
    const values = recentMetrics(metrics, record.company_code, record.meeting_date).map((metric) => metric.roe);
    if (values.length < 3 || values.some((value) => value === null || value >= threshold)) return false;
  }

  return true;
}

function defaultCondition(): SavedCondition {
  return {
    id: `condition_${Date.now()}`,
    name: "BlackRock ROE責任者仮説",
    vote: "反対",
    issueType: "low_roe",
    detailTag: "all",
    keyword: "社長 会長 代表 CEO",
    roeBelow: "5",
  };
}

export function InvestorAnalysisWorkspace({ investorId, records, financialMetrics }: Props) {
  const [tab, setTab] = useState<"list" | "conditions" | "roe">("list");
  const [draft, setDraft] = useState<SavedCondition>(defaultCondition);
  const [conditions, setConditions] = useState<SavedCondition[]>([]);

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
    if (raw) setConditions(JSON.parse(raw));
  }, [investorId]);

  function saveCondition() {
    const next = [...conditions, { ...draft, id: `condition_${Date.now()}` }];
    setConditions(next);
    window.localStorage.setItem(`analysis_conditions_${investorId}`, JSON.stringify(next));
  }

  function deleteCondition(id: string) {
    const next = conditions.filter((condition) => condition.id !== id);
    setConditions(next);
    window.localStorage.setItem(`analysis_conditions_${investorId}`, JSON.stringify(next));
  }

  const roeRows = useMemo(() => {
    const unique = new Map<string, VoteRecord>();
    for (const record of investorRecords) {
      const key = `${record.company_code}-${record.vote}-${record.issue_type}`;
      if (!unique.has(key)) unique.set(key, record);
    }

    return [...unique.values()]
      .map((record) => {
        const metrics = recentMetrics(financialMetrics, record.company_code, record.meeting_date);
        const roes = metrics.map((metric) => metric.roe);
        return {
          record,
          metrics,
          allBelow5: roes.length === 3 && roes.every((roe) => roe !== null && roe < 5),
        };
      })
      .sort((a, b) => Number(b.allBelow5) - Number(a.allBelow5) || a.record.company_code.localeCompare(b.record.company_code));
  }, [financialMetrics, investorRecords]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            ["list", "行使先一覧"],
            ["conditions", "詳細条件分析"],
            ["roe", "ROEボーダー分析"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as "list" | "conditions" | "roe")}
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
          <h2 className="text-lg font-bold">詳細条件分析</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            操作者側で仮説条件を作成できます。例: 「3期連続ROE5%未満」かつ「反対」かつ「社長/会長/代表/CEOを含む」など。
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input className="rounded border px-3 py-2 text-sm" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="条件名" />
            <select className="rounded border bg-white px-3 py-2 text-sm" value={draft.vote} onChange={(event) => setDraft({ ...draft, vote: event.target.value as SavedCondition["vote"] })}>
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
            <input className="rounded border px-3 py-2 text-sm" value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} placeholder="キーワード: 社長 会長 代表 CEO" />
            <input className="rounded border px-3 py-2 text-sm" value={draft.roeBelow} onChange={(event) => setDraft({ ...draft, roeBelow: event.target.value })} placeholder="直近3期ROEが全て未満: 5" />
          </div>

          <button type="button" onClick={saveCondition} className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white">
            条件を保存
          </button>

          <div className="mt-5 space-y-3">
            {[draft, ...conditions].map((condition, index) => {
              const matched = investorRecords.filter((record) => matchesCondition(record, financialMetrics, condition));
              const against = matched.filter((record) => record.vote === "反対").length;
              const forVotes = matched.filter((record) => record.vote === "賛成").length;
              const ratio = matched.length > 0 ? Math.round((against / matched.length) * 100) : 0;
              return (
                <div key={index === 0 ? "draft" : condition.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{index === 0 ? "プレビュー: " : ""}{condition.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        行使={condition.vote} / 論点={condition.issueType === "all" ? "全て" : issueLabel(condition.issueType)} / 詳細={condition.detailTag === "all" ? "全て" : condition.detailTag} / キーワード={condition.keyword || "-"} / ROE&lt;{condition.roeBelow || "-"}
                      </p>
                    </div>
                    {index > 0 && <button type="button" onClick={() => deleteCondition(condition.id)} className="rounded border px-3 py-1 text-xs text-slate-600">削除</button>}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <div className="rounded bg-slate-50 p-2"><p className="text-xs text-slate-500">該当</p><p className="text-lg font-bold">{matched.length}</p></div>
                    <div className="rounded bg-red-50 p-2"><p className="text-xs text-red-700">反対</p><p className="text-lg font-bold text-red-700">{against}</p></div>
                    <div className="rounded bg-green-50 p-2"><p className="text-xs text-green-700">賛成</p><p className="text-lg font-bold text-green-700">{forVotes}</p></div>
                    <div className="rounded bg-amber-50 p-2"><p className="text-xs text-amber-700">反対比率</p><p className="text-lg font-bold text-amber-700">{ratio}%</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "roe" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">ROEボーダー分析</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            過去賛否を出した企業の直近3期ROEを横に並べます。5%未満がどこまで反対・賛成に分かれるかを見るための表です。
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">企業</th>
                  <th className="px-3 py-2 text-left">行使</th>
                  <th className="px-3 py-2 text-left">論点</th>
                  <th className="px-3 py-2 text-right">ROE 1</th>
                  <th className="px-3 py-2 text-right">ROE 2</th>
                  <th className="px-3 py-2 text-right">ROE 3</th>
                  <th className="px-3 py-2 text-left">3期5%未満</th>
                  <th className="px-3 py-2 text-left">理由</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roeRows.slice(0, 300).map(({ record, metrics, allBelow5 }, index) => (
                  <tr key={`${record.company_code}-${record.vote}-${record.issue_type}-${index}`}>
                    <td className="px-3 py-2"><p className="font-semibold">{record.company_name || record.company_code}</p><p className="text-slate-500">{record.company_code}</p></td>
                    <td className="px-3 py-2"><span className={record.vote === "反対" ? "text-red-700" : "text-green-700"}>{record.vote}</span></td>
                    <td className="px-3 py-2">{issueLabel(record.issue_type)}</td>
                    {[0, 1, 2].map((i) => (
                      <td key={i} className="px-3 py-2 text-right">
                        {metrics[i]?.roe == null ? "-" : `${metrics[i].fiscal_year}: ${metrics[i].roe?.toFixed(1)}%`}
                      </td>
                    ))}
                    <td className="px-3 py-2">{allBelow5 ? <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">該当</span> : <span className="text-slate-400">-</span>}</td>
                    <td className="max-w-md px-3 py-2 leading-5 text-slate-600">{record.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
