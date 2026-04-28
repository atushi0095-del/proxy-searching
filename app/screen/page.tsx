import Link from "next/link";
import {
  companies,
  companyGovernanceMetrics,
  financialMetrics,
  investors,
} from "@/lib/data";
import { runJudgment, issueLabels } from "@/lib/inference";
import { ScreenerFilterForm } from "@/components/ScreenerFilterForm";
import type { CompanyGovernanceMetric, FinancialMetric, InvestorJudgment, IssueType, OppositionLevel } from "@/lib/types";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface Params {
  searchParams: Promise<{
    indep_min?: string;
    indep_max?: string;
    female_min?: string;
    roe_max?: string;
    roe_periods?: string;
    board_type?: string;
    investor?: string;
    view?: string;
  }>;
}

interface CompanyResult {
  company_code: string;
  company_name: string;
  market: string;
  sector: string;
  gov: CompanyGovernanceMetric | null;
  latestROE: number | null;
  roePeriodsBelowThreshold: number;
  boardType: string;
  judgments: InvestorJudgment[];
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const LEVEL_ORDER: Record<OppositionLevel, number> = {
  High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0,
};

const levelClass: Record<OppositionLevel, string> = {
  High: "bg-red-100 text-red-700",
  "Medium-High": "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-gray-100 text-gray-600",
  "Not likely": "bg-green-50 text-green-700",
};

function inferBoardType(gov: CompanyGovernanceMetric): string {
  if (gov.has_nominating_committee) return "nomination_committee";
  if (gov.has_compensation_committee) return "audit_committee";
  return "audit";
}

function boardTypeLabel(t: string): string {
  return { audit: "監査役設置", audit_committee: "監査等委員会", nomination_committee: "指名委員会等" }[t] ?? t;
}

function boardTypeBadge(t: string): string {
  return {
    audit: "bg-slate-100 text-slate-600",
    audit_committee: "bg-teal-50 text-teal-700",
    nomination_committee: "bg-purple-50 text-purple-700",
  }[t] ?? "bg-slate-100 text-slate-600";
}

/** 企業の直近 N 期のうち ROE が閾値以下の期数を返す */
function countPeriodsBelow(code: string, threshold: number): number {
  const metrics = financialMetrics
    .filter(m => m.company_code === code && m.roe != null)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 3);
  return metrics.filter(m => (m.roe as number) <= threshold).length;
}

function latestROE(code: string): number | null {
  const sorted = financialMetrics
    .filter(m => m.company_code === code && m.roe != null)
    .sort((a, b) => b.fiscal_year - a.fiscal_year);
  return sorted.length > 0 ? (sorted[0].roe as number) : null;
}

function topOpposedIssue(judgment: InvestorJudgment): IssueType | null {
  const allScores = judgment.opposition_candidates.flatMap(c => c.issue_scores);
  if (allScores.length === 0) return null;
  const best = allScores.reduce((a, b) =>
    LEVEL_ORDER[b.level] > LEVEL_ORDER[a.level] ? b : a
  );
  return LEVEL_ORDER[best.level] > 0 ? best.issue_type : null;
}

// ────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────

export default async function ScreenPage({ searchParams }: Params) {
  const sp = await searchParams;
  const YEAR = 2025;

  // ── フィルター値パース ──
  const indepMin = sp.indep_min ? Number(sp.indep_min) : null;
  const indepMax = sp.indep_max ? Number(sp.indep_max) : null;
  const femaleMin = sp.female_min ? Number(sp.female_min) : null;
  const roeMax = sp.roe_max !== undefined ? Number(sp.roe_max) : null;
  const roePeriods = sp.roe_periods ? Number(sp.roe_periods) : null;
  const boardTypeFilter = sp.board_type ? sp.board_type.split(",") : [];
  const investorFilter = sp.investor ?? "";
  const view = sp.view === "investor" ? "investor" : "company";

  const hasFilter =
    indepMin !== null || indepMax !== null || femaleMin !== null ||
    roeMax !== null || boardTypeFilter.length > 0;

  // ── ガバナンス辞書 ──
  const govMap = new Map<string, CompanyGovernanceMetric>();
  for (const g of companyGovernanceMetrics) {
    if (!govMap.has(g.company_code) || g.meeting_year > (govMap.get(g.company_code)?.meeting_year ?? 0)) {
      govMap.set(g.company_code, g);
    }
  }

  // ── 絞り込み ──
  const targetInvestors = investorFilter
    ? investors.filter(i => i.investor_id === investorFilter)
    : investors;

  const filtered: CompanyResult[] = [];

  for (const c of companies) {
    const gov = govMap.get(c.company_code) ?? null;
    const bt = gov ? inferBoardType(gov) : "audit";
    const roe = latestROE(c.company_code);

    // フィルター適用
    if (gov) {
      if (indepMin !== null && gov.independent_director_ratio < indepMin) continue;
      if (indepMax !== null && gov.independent_director_ratio > indepMax) continue;
      if (femaleMin !== null && gov.female_director_ratio < femaleMin) continue;
      if (boardTypeFilter.length > 0 && !boardTypeFilter.includes(bt)) continue;
    } else if (hasFilter) {
      continue; // ガバナンスデータなし & フィルターあり → スキップ
    }

    if (roeMax !== null) {
      if (roe === null) continue;
      if (roePeriods != null && roePeriods >= 2) {
        const belowCount = countPeriodsBelow(c.company_code, roeMax);
        if (belowCount < roePeriods) continue;
      } else {
        if (roe > roeMax) continue;
      }
    }

    // 判定実行
    const judgments = targetInvestors
      .map(inv => runJudgment(inv.investor_id, c.company_code, YEAR))
      .filter((j): j is InvestorJudgment => j !== null);

    const roePeriodsBelowThreshold = roeMax !== null
      ? countPeriodsBelow(c.company_code, roeMax)
      : 0;

    filtered.push({
      company_code: c.company_code,
      company_name: c.company_name,
      market: c.market,
      sector: c.sector,
      gov,
      latestROE: roe,
      roePeriodsBelowThreshold,
      boardType: bt,
      judgments,
    });
  }

  // 反対推定数の多い順にソート
  filtered.sort((a, b) => {
    const aMax = a.judgments.reduce((acc, j) => {
      const top = j.opposition_candidates.reduce((m, c) => Math.max(m, LEVEL_ORDER[c.overall_level]), 0);
      return Math.max(acc, top);
    }, 0);
    const bMax = b.judgments.reduce((acc, j) => {
      const top = j.opposition_candidates.reduce((m, c) => Math.max(m, LEVEL_ORDER[c.overall_level]), 0);
      return Math.max(acc, top);
    }, 0);
    return bMax - aMax;
  });

  // 統計
  const totalOppositionCount = filtered.reduce((acc, r) =>
    acc + r.judgments.reduce((a, j) =>
      a + j.opposition_candidates.filter(c => LEVEL_ORDER[c.overall_level] >= 2).length, 0
    ), 0
  );

  const filterForm = {
    indepMin, indepMax, femaleMin, roeMax, roePeriods,
    boardType: boardTypeFilter, investor: investorFilter,
  };

  // 投資家別集計
  const investorOppositions = targetInvestors.map(inv => {
    const items: { company_code: string; company_name: string; issue: IssueType | null; level: OppositionLevel; directors: string[] }[] = [];
    for (const r of filtered) {
      const j = r.judgments.find(j => j.investor.investor_id === inv.investor_id);
      if (!j) continue;
      const topCandidates = j.opposition_candidates.filter(c => LEVEL_ORDER[c.overall_level] >= 2);
      if (topCandidates.length === 0) continue;
      const overallLevel = topCandidates.reduce<OppositionLevel>((max, c) =>
        LEVEL_ORDER[c.overall_level] > LEVEL_ORDER[max] ? c.overall_level : max, "Not likely"
      );
      const issue = topOpposedIssue(j);
      const directorNames = topCandidates.slice(0, 3).map(c => c.director.name);
      items.push({ company_code: r.company_code, company_name: r.company_name, issue, level: overallLevel, directors: directorNames });
    }
    return { investor: inv, items };
  }).filter(x => x.items.length > 0);

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">企業スクリーニング</h1>
        <p className="mt-1 text-sm text-slate-500">
          ガバナンス・財務指標で企業を絞り込み、投資家別の反対推定を一覧します。
        </p>
      </div>

      {/* フィルターフォーム */}
      <ScreenerFilterForm investors={investors} currentFilters={filterForm} />

      {/* 結果ヘッダー */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-4">
          <span className="text-sm font-bold text-slate-700">{filtered.length}社 該当</span>
          <span className="text-sm text-slate-500">{totalOppositionCount}件の反対推定（Medium以上）</span>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            href={`/screen?${new URLSearchParams({ ...Object.fromEntries(Object.entries({
              indep_min: indepMin, indep_max: indepMax, female_min: femaleMin,
              roe_max: roeMax, roe_periods: roePeriods, board_type: boardTypeFilter.join(",") || undefined,
              investor: investorFilter || undefined, view: "company",
            }).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])) })}`}
            className={`rounded border px-3 py-1.5 text-sm ${view === "company" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            企業一覧
          </Link>
          <Link
            href={`/screen?${new URLSearchParams({ ...Object.fromEntries(Object.entries({
              indep_min: indepMin, indep_max: indepMax, female_min: femaleMin,
              roe_max: roeMax, roe_periods: roePeriods, board_type: boardTypeFilter.join(",") || undefined,
              investor: investorFilter || undefined, view: "investor",
            }).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])) })}`}
            className={`rounded border px-3 py-1.5 text-sm ${view === "investor" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            投資家別
          </Link>
        </div>
      </div>

      {/* ── 企業一覧タブ ── */}
      {view === "company" && (
        <div className="rounded-xl border bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              条件に合う企業が見つかりませんでした。条件を変更してください。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <th className="px-4 py-3">企業</th>
                    <th className="px-4 py-3">市場</th>
                    <th className="px-4 py-3 text-center">機関設計</th>
                    <th className="px-4 py-3 text-right">社外比率</th>
                    <th className="px-4 py-3 text-right">女性比率</th>
                    <th className="px-4 py-3 text-right">ROE</th>
                    <th className="px-4 py-3 text-center">反対推定（投資家別）</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(r => {
                    const highOppositions = r.judgments.filter(j =>
                      j.opposition_candidates.some(c => LEVEL_ORDER[c.overall_level] >= 3)
                    );
                    return (
                      <tr key={r.company_code} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{r.company_name}</div>
                          <div className="text-xs text-slate-400">{r.company_code} / {r.sector}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${
                            r.market === "東証プライム" ? "border-blue-200 bg-blue-50 text-blue-700"
                            : r.market === "東証スタンダード" ? "border-green-200 bg-green-50 text-green-700"
                            : "border-orange-200 bg-orange-50 text-orange-700"
                          }`}>{r.market?.replace("東証", "") ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${boardTypeBadge(r.boardType)}`}>
                            {boardTypeLabel(r.boardType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.gov ? (
                            <span className={r.gov.independent_director_ratio < 33 ? "font-semibold text-red-600" : "text-slate-700"}>
                              {r.gov.independent_director_ratio.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.gov ? (
                            <span className={r.gov.female_director_ratio === 0 ? "font-semibold text-amber-600" : "text-slate-700"}>
                              {r.gov.female_director_ratio.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.latestROE !== null ? (
                            <span className={r.latestROE < 5 ? "font-semibold text-red-600" : "text-slate-700"}>
                              {r.latestROE.toFixed(1)}%
                              {roeMax !== null && r.roePeriodsBelowThreshold >= 2 && (
                                <span className="ml-1 text-xs text-slate-400">({r.roePeriodsBelowThreshold}期)</span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-center gap-1">
                            {r.judgments.map(j => {
                              const topLevel = j.opposition_candidates.reduce<OppositionLevel>(
                                (max, c) => LEVEL_ORDER[c.overall_level] > LEVEL_ORDER[max] ? c.overall_level : max,
                                "Not likely"
                              );
                              if (LEVEL_ORDER[topLevel] === 0) return null;
                              const issue = topOpposedIssue(j);
                              return (
                                <Link
                                  key={j.investor.investor_id}
                                  href={`/companies/${r.company_code}?year=${YEAR}&investor=${j.investor.investor_id}`}
                                  title={`${j.investor.investor_name}${issue ? " — " + issueLabels[issue] : ""}`}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight hover:opacity-80 ${levelClass[topLevel]}`}
                                >
                                  {j.investor.investor_name.slice(0, 6)}
                                </Link>
                              );
                            }).filter(Boolean)}
                            {r.judgments.every(j => j.opposition_candidates.every(c => c.overall_level === "Not likely")) && (
                              <span className="text-xs text-slate-400">反対推定なし</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/companies/${r.company_code}?year=${YEAR}${investorFilter ? `&investor=${investorFilter}` : ""}`}
                            className="rounded border px-2 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            詳細 →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 投資家別タブ ── */}
      {view === "investor" && (
        <div className="space-y-4">
          {investorOppositions.length === 0 ? (
            <div className="rounded-xl border bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              条件に合う企業への反対推定がありません。
            </div>
          ) : (
            investorOppositions.map(({ investor: inv, items }) => {
              // 論点ごとにグループ化
              const byIssue = new Map<string, typeof items>();
              for (const item of items) {
                const key = item.issue ?? "other";
                if (!byIssue.has(key)) byIssue.set(key, []);
                byIssue.get(key)!.push(item);
              }

              return (
                <div key={inv.investor_id} className="rounded-xl border bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b px-5 py-4">
                    <div>
                      <Link href={`/investors/${inv.investor_id}`} className="font-bold text-slate-900 hover:text-blue-700">
                        {inv.investor_name}
                      </Link>
                      <p className="text-xs text-slate-500">{inv.country} / {inv.investor_type}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        {items.length}社に反対推定
                      </span>
                      <Link
                        href={`/investors/${inv.investor_id}`}
                        className="rounded border px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                      >
                        ガイドライン →
                      </Link>
                    </div>
                  </div>

                  {/* 論点別グループ */}
                  <div className="divide-y">
                    {Array.from(byIssue.entries()).map(([issueKey, issueItems]) => (
                      <div key={issueKey} className="px-5 py-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {issueKey !== "other" ? issueLabels[issueKey as IssueType] : "その他"}
                          </span>
                          <span className="text-xs text-slate-400">{issueItems.length}社</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {issueItems.map(item => (
                            <Link
                              key={item.company_code}
                              href={`/companies/${item.company_code}?year=${YEAR}&investor=${inv.investor_id}`}
                              className="group flex items-center gap-1.5 rounded border bg-slate-50 px-2.5 py-1.5 hover:border-blue-300 hover:bg-blue-50"
                            >
                              <div>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${levelClass[item.level]}`}>
                                  {item.level}
                                </span>
                                <span className="ml-1.5 text-xs font-medium text-slate-800 group-hover:text-blue-700">
                                  {item.company_name}
                                </span>
                                {item.directors.length > 0 && (
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    ({item.directors.join("・")})
                                  </span>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 注記 */}
      <p className="text-xs text-slate-400">
        ※ 反対推定は登録済みガイドラインルールと財務・ガバナンスデータに基づく分析支援です。実際の行使判断は各投資家の最新公式資料を確認してください。機関設計の判定は概算です（指名・報酬委員会の設置有無から推定）。
      </p>
    </div>
  );
}
