import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import {
  companies,
  companyGovernanceMetrics,
  directors as allDirectors,
  financialMetrics,
  investors,
} from "@/lib/data";
import { runJudgment, issueLabels } from "@/lib/inference";
import { ScreenerFilterForm } from "@/components/ScreenerFilterForm";
import { ScreenerResultTable } from "@/components/ScreenerResultTable";
import type { CompanyTableRow, InvestorDetailRow, DirectorSummary } from "@/components/ScreenerResultTable";
import type { CompanyGovernanceMetric, InvestorJudgment, IssueType, OppositionLevel } from "@/lib/types";

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
    // 役員構成
    has_rep_chair?: string;        // "true" | "false"
    outside_tenure_min?: string;   // 数値（年）
    board_chair_type?: string;     // "outside" | "inside"
    has_female_outside?: string;   // "true" | "false"
    // UI
    investor?: string;
    view?: string;
  }>;
}

interface FocusInvestorData {
  against: number;
  for: number;
}

interface FocusExample {
  investor_id: string;
  issue_type: string;
  meeting_date?: string;
  reason?: string;
}

interface FocusCompany {
  company_code: string;
  company_name: string;
  against_count: number;
  for_count?: number;
  investors: Record<string, number | FocusInvestorData>;
  issues: Record<string, number>;
  recent_against?: FocusExample[];
  recent_examples?: FocusExample[];
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const LEVEL_ORDER: Record<OppositionLevel, number> = {
  High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0,
};

const levelBadgeClass: Record<OppositionLevel, string> = {
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
  return (
    { audit: "監査役設置", audit_committee: "監査等委員会", nomination_committee: "指名委員会等" }[t] ?? t
  );
}

function boardTypeBadge(t: string): string {
  return (
    {
      audit: "bg-slate-100 text-slate-600",
      audit_committee: "bg-teal-50 text-teal-700",
      nomination_committee: "bg-purple-50 text-purple-700",
    }[t] ?? "bg-slate-100 text-slate-600"
  );
}

function countPeriodsBelow(code: string, threshold: number): number {
  return financialMetrics
    .filter(m => m.company_code === code && m.roe != null)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, 3)
    .filter(m => (m.roe as number) <= threshold).length;
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
  const best = allScores.reduce((a, b) => (LEVEL_ORDER[b.level] > LEVEL_ORDER[a.level] ? b : a));
  return LEVEL_ORDER[best.level] > 0 ? best.issue_type : null;
}

function focusInvestorVotes(
  focus: FocusCompany,
  investor_id: string,
): { against: number; for: number } {
  const v = focus.investors[investor_id];
  if (v === undefined) return { against: 0, for: 0 };
  if (typeof v === "number") return { against: v, for: 0 };
  return { against: v.against ?? 0, for: v.for ?? 0 };
}

function buildActualSummary(
  focus: FocusCompany | undefined,
  investor_id: string,
): { summary: string; against: number; for: number; reasons: string[] } {
  if (!focus) return { summary: "行使実績なし", against: 0, for: 0, reasons: [] };

  const { against, for: forCount } = focusInvestorVotes(focus, investor_id);

  if (against === 0 && forCount === 0) {
    return { summary: "行使実績なし", against: 0, for: 0, reasons: [] };
  }

  // Collect reasons from recent examples
  const examples = (focus.recent_against ?? focus.recent_examples ?? []).filter(
    e => e.investor_id === investor_id,
  );
  const reasons = examples
    .map(e => e.reason)
    .filter((r): r is string => !!r)
    .slice(0, 2);

  // Top issue from actual data
  const issueEntries = Object.entries(focus.issues).sort((a, b) => b[1] - a[1]);
  const topIssueKey = issueEntries[0]?.[0];
  const topIssueLabel = topIssueKey ? (issueLabels[topIssueKey as IssueType] ?? topIssueKey) : "";

  if (against > 0) {
    const issueNote = topIssueLabel ? `（${topIssueLabel}）` : "";
    return {
      summary: `${against}件反対${issueNote}`,
      against,
      for: forCount,
      reasons,
    };
  }
  return {
    summary: `全賛成（${forCount}件）`,
    against: 0,
    for: forCount,
    reasons: [],
  };
}

const levelBadgeCls: Record<OppositionLevel, string> = {
  High: "bg-red-100 text-red-700",
  "Medium-High": "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-gray-100 text-gray-600",
  "Not likely": "bg-green-50 text-green-700",
};

function buildEstimatedSummary(
  judgment: InvestorJudgment | undefined,
): { level: OppositionLevel; summary: string; opposition_directors: DirectorSummary[] } {
  if (!judgment || judgment.opposition_candidates.length === 0) {
    return { level: "Not likely", summary: "推定データなし", opposition_directors: [] };
  }
  const topLevel = judgment.opposition_candidates.reduce<OppositionLevel>(
    (max, c) => (LEVEL_ORDER[c.overall_level] > LEVEL_ORDER[max] ? c.overall_level : max),
    "Not likely",
  );
  if (LEVEL_ORDER[topLevel] === 0) {
    return { level: "Not likely", summary: "反対推定なし", opposition_directors: [] };
  }
  const issue = topOpposedIssue(judgment);
  const issueLabel = issue ? issueLabels[issue] : "";

  // Build director summaries for Level >= Low (show all candidates with any flag)
  const opposition_directors: DirectorSummary[] = judgment.opposition_candidates
    .filter(c => LEVEL_ORDER[c.overall_level] >= 1)
    .slice(0, 6)
    .map(c => {
      const dir = c.director;
      const iss_labels = c.issue_scores
        .filter(s => LEVEL_ORDER[s.level] >= 1)
        .sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level])
        .slice(0, 2)
        .map(s => s.issue_label);
      return {
        name: dir.name,
        is_president: dir.is_president,
        is_chair: dir.is_chair,
        is_outside_director: dir.is_outside_director,
        is_female: dir.is_female,
        has_representative_authority: dir.has_representative_authority,
        is_board_chair: dir.is_board_chair,
        is_nomination_committee_chair: dir.is_nominating_committee_chair,
        tenure_years: dir.tenure_years_before_meeting ?? null,
        level: c.overall_level,
        level_badge_class: levelBadgeCls[c.overall_level],
        issue_labels: iss_labels,
      };
    });

  return {
    level: topLevel,
    summary: `${topLevel}${issueLabel ? `（${issueLabel}）` : ""}`,
    opposition_directors,
  };
}

// ────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────

export default async function ScreenPage({ searchParams }: Params) {
  const sp = await searchParams;
  const YEAR = 2025;

  // ── opposition_focus_companies.json を読み込む ──
  let focusMap = new Map<string, FocusCompany>();
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data/generated/opposition_focus_companies.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as { companies?: FocusCompany[] };
    for (const c of parsed.companies ?? []) {
      focusMap.set(String(c.company_code), c);
    }
  } catch {
    // ファイルが存在しない場合はスキップ
  }

  // ── フィルター値パース ──
  const indepMin = sp.indep_min ? Number(sp.indep_min) : null;
  const indepMax = sp.indep_max ? Number(sp.indep_max) : null;
  const femaleMin = sp.female_min ? Number(sp.female_min) : null;
  const roeMax = sp.roe_max !== undefined ? Number(sp.roe_max) : null;
  const roePeriods = sp.roe_periods ? Number(sp.roe_periods) : null;
  const boardTypeFilter = sp.board_type ? sp.board_type.split(",") : [];
  // 役員構成フィルター
  const hasRepChairFilter = sp.has_rep_chair ?? "";        // "true" | "false" | ""
  const outsideTenureMin  = sp.outside_tenure_min ? Number(sp.outside_tenure_min) : null;
  const boardChairType    = sp.board_chair_type ?? "";     // "outside" | "inside" | ""
  const hasFemaleOutside  = sp.has_female_outside ?? "";   // "true" | "false" | ""
  const investorFilter = sp.investor ?? "";
  const view = sp.view === "investor" ? "investor" : "company";

  const hasFilter =
    indepMin !== null || indepMax !== null || femaleMin !== null ||
    roeMax !== null || boardTypeFilter.length > 0 ||
    hasRepChairFilter !== "" || outsideTenureMin !== null ||
    boardChairType !== "" || hasFemaleOutside !== "";

  // ── 役員辞書: company_code → Director[] ──
  // tenure を統一: tenure_years_before_meeting があればそれを使い、
  // なければ seed スクリプトが書いた tenure_years を参照
  type DirectorLike = {
    company_code: string;
    meeting_year: number;
    is_chair: boolean;
    has_representative_authority: boolean;
    is_outside_director: boolean;
    is_female: boolean;
    is_board_chair: boolean;
    tenure_years_before_meeting?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  const dirMap = new Map<string, DirectorLike[]>();
  for (const d of allDirectors as DirectorLike[]) {
    const arr = dirMap.get(d.company_code) ?? [];
    arr.push(d);
    dirMap.set(d.company_code, arr);
  }

  function dirTenure(d: DirectorLike): number {
    return d.tenure_years_before_meeting ?? (d as { tenure_years?: number }).tenure_years ?? 0;
  }

  function passesDirectorFilters(code: string): boolean {
    const dirs = dirMap.get(code);
    // 役員データが全くない場合: 役員構成フィルターが掛かっているときはスキップ
    const hasDirectorFilter =
      hasRepChairFilter !== "" || outsideTenureMin !== null ||
      boardChairType !== "" || hasFemaleOutside !== "";
    if (!dirs || dirs.length === 0) return !hasDirectorFilter;

    // 代表取締役会長
    if (hasRepChairFilter !== "") {
      const has = dirs.some(d => d.is_chair && d.has_representative_authority);
      if (hasRepChairFilter === "true" && !has) return false;
      if (hasRepChairFilter === "false" && has) return false;
    }

    // 社外取締役在任期間
    if (outsideTenureMin !== null) {
      const has = dirs.some(d => d.is_outside_director && dirTenure(d) >= outsideTenureMin);
      if (!has) return false;
    }

    // 取締役会議長の属性
    if (boardChairType !== "") {
      const chairs = dirs.filter(d => d.is_board_chair);
      if (boardChairType === "outside") {
        if (!chairs.some(d => d.is_outside_director)) return false;
      } else if (boardChairType === "inside") {
        if (!chairs.some(d => !d.is_outside_director)) return false;
      }
    }

    // 女性社外取締役
    if (hasFemaleOutside !== "") {
      const has = dirs.some(d => d.is_outside_director && d.is_female);
      if (hasFemaleOutside === "true" && !has) return false;
      if (hasFemaleOutside === "false" && has) return false;
    }

    return true;
  }

  // ── ガバナンス辞書 ──
  const govMap = new Map<string, CompanyGovernanceMetric>();
  for (const g of companyGovernanceMetrics) {
    if (
      !govMap.has(g.company_code) ||
      g.meeting_year > (govMap.get(g.company_code)?.meeting_year ?? 0)
    ) {
      govMap.set(g.company_code, g);
    }
  }

  const targetInvestors = investorFilter
    ? investors.filter(i => i.investor_id === investorFilter)
    : investors;

  // ── 絞り込み & 各社の判定実行 ──
  const companyRows: CompanyTableRow[] = [];

  for (const c of companies) {
    const gov = govMap.get(c.company_code) ?? null;
    const bt = gov ? inferBoardType(gov) : "audit";
    const roe = latestROE(c.company_code);

    // ── ガバナンス比率フィルター ──
    const govFilterActive =
      indepMin !== null || indepMax !== null || femaleMin !== null || boardTypeFilter.length > 0;
    if (gov) {
      if (indepMin !== null && gov.independent_director_ratio < indepMin) continue;
      if (indepMax !== null && gov.independent_director_ratio > indepMax) continue;
      if (femaleMin !== null && gov.female_director_ratio < femaleMin) continue;
      if (boardTypeFilter.length > 0 && !boardTypeFilter.includes(bt)) continue;
    } else if (govFilterActive) {
      continue; // ガバナンスデータなし & 比率フィルターあり
    }

    // ── ROE フィルター ──
    if (roeMax !== null) {
      if (roe === null) continue;
      if (roePeriods != null && roePeriods >= 2) {
        if (countPeriodsBelow(c.company_code, roeMax) < roePeriods) continue;
      } else {
        if (roe > roeMax) continue;
      }
    }

    // ── 役員構成フィルター ──
    if (!passesDirectorFilters(c.company_code)) continue;

    // 判定実行
    const judgments = targetInvestors
      .map(inv => runJudgment(inv.investor_id, c.company_code, YEAR))
      .filter((j): j is InvestorJudgment => j !== null);

    const roePeriodsBelowThreshold =
      roeMax !== null ? countPeriodsBelow(c.company_code, roeMax) : 0;

    // Focus データ
    const focus = focusMap.get(c.company_code);

    // ── 投資家バッジ（メイン行用） ──
    const investorBadges: CompanyTableRow["investorBadges"] = [];
    let hasAnyOpposition = false;

    for (const j of judgments) {
      const topLevel = j.opposition_candidates.reduce<OppositionLevel>(
        (max, cand) =>
          LEVEL_ORDER[cand.overall_level] > LEVEL_ORDER[max] ? cand.overall_level : max,
        "Not likely",
      );
      if (LEVEL_ORDER[topLevel] === 0) continue;
      hasAnyOpposition = true;
      const issue = topOpposedIssue(j);
      investorBadges.push({
        investor_id: j.investor.investor_id,
        shortName: j.investor.investor_name.slice(0, 6),
        badgeClass: levelBadgeClass[topLevel],
        title: `${j.investor.investor_name}${issue ? " — " + issueLabels[issue] : ""}`,
        href: `/companies/${c.company_code}?year=${YEAR}&investor=${j.investor.investor_id}`,
      });
    }

    // ── 投資家詳細（展開行用） ──
    const investorDetails: InvestorDetailRow[] = targetInvestors.map(inv => {
      const judgment = judgments.find(j => j.investor.investor_id === inv.investor_id);
      const actual = buildActualSummary(focus, inv.investor_id);
      const estimated = buildEstimatedSummary(judgment);
      return {
        investor_id: inv.investor_id,
        investor_name: inv.investor_name,
        actual_summary: actual.summary,
        actual_against: actual.against,
        actual_for: actual.for,
        actual_reasons: actual.reasons,
        estimated_level: estimated.level,
        estimated_summary: estimated.summary,
        opposition_directors: estimated.opposition_directors,
        company_detail_href: `/companies/${c.company_code}?year=${YEAR}&investor=${inv.investor_id}`,
      };
    });

    // ── CompanyTableRow 組み立て ──
    const marketBadgeClass =
      c.market === "東証プライム"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : c.market === "東証スタンダード"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-orange-200 bg-orange-50 text-orange-700";

    companyRows.push({
      company_code: c.company_code,
      company_name: c.company_name,
      market: c.market,
      sector: c.sector,
      boardTypeLabel: boardTypeLabel(bt),
      boardTypeBadgeClass: boardTypeBadge(bt),
      marketBadgeClass,
      indepRatio: gov?.independent_director_ratio ?? null,
      femaleRatio: gov?.female_director_ratio ?? null,
      indepRatioClass:
        gov && gov.independent_director_ratio < 33 ? "font-semibold text-red-600" : "text-slate-700",
      femaleRatioClass:
        gov && gov.female_director_ratio === 0 ? "font-semibold text-amber-600" : "text-slate-700",
      latestROE: roe,
      roeClass: roe !== null && roe < 5 ? "font-semibold text-red-600" : "text-slate-700",
      roeNote:
        roeMax !== null && roePeriodsBelowThreshold >= 2
          ? `(${roePeriodsBelowThreshold}期)`
          : "",
      hasAnyOpposition,
      investorBadges,
      investorDetails,
      detailHref: `/companies/${c.company_code}?year=${YEAR}${investorFilter ? `&investor=${investorFilter}` : ""}`,
    });
  }

  // 反対推定スコア降順ソート
  companyRows.sort((a, b) => {
    const scoreOf = (row: CompanyTableRow) =>
      row.investorDetails.reduce(
        (acc, d) => Math.max(acc, LEVEL_ORDER[d.estimated_level as OppositionLevel] ?? 0),
        0,
      );
    return scoreOf(b) - scoreOf(a);
  });

  // 統計
  const totalOppositionCount = companyRows.reduce(
    (acc, r) =>
      acc +
      r.investorDetails.filter(d => LEVEL_ORDER[d.estimated_level as OppositionLevel] >= 2)
        .length,
    0,
  );

  const filterForm = {
    indepMin,
    indepMax,
    femaleMin,
    roeMax,
    roePeriods,
    boardType: boardTypeFilter,
    hasRepChair: hasRepChairFilter as "" | "true" | "false",
    outsideTenureMin,
    boardChairType: boardChairType as "" | "outside" | "inside",
    hasFemaleOutside: hasFemaleOutside as "" | "true" | "false",
    investor: investorFilter,
  };

  // 投資家別集計（投資家別タブ用）
  const investorOppositions = targetInvestors
    .map(inv => {
      const items: {
        company_code: string;
        company_name: string;
        level: OppositionLevel;
        issue: IssueType | null;
        directors: string[];
      }[] = [];
      for (const row of companyRows) {
        const detail = row.investorDetails.find(d => d.investor_id === inv.investor_id);
        if (!detail) continue;
        const lvl = detail.estimated_level as OppositionLevel;
        if (LEVEL_ORDER[lvl] < 2) continue;
        const judgment = targetInvestors
          .map(i => runJudgment(i.investor_id, row.company_code, YEAR))
          .find(j => j?.investor.investor_id === inv.investor_id) ?? null;
        items.push({
          company_code: row.company_code,
          company_name: row.company_name,
          level: lvl,
          issue: judgment ? topOpposedIssue(judgment) : null,
          directors: detail.opposition_directors.slice(0, 3).map(d => d.name),
        });
      }
      return { investor: inv, items };
    })
    .filter(x => x.items.length > 0);

  // URLビルダー
  const buildTabUrl = (v: "company" | "investor") => {
    const params = Object.fromEntries(
      Object.entries({
        indep_min: indepMin,
        indep_max: indepMax,
        female_min: femaleMin,
        roe_max: roeMax,
        roe_periods: roePeriods,
        board_type: boardTypeFilter.join(",") || undefined,
        investor: investorFilter || undefined,
        view: v,
      })
        .filter(([, val]) => val != null && val !== "")
        .map(([k, val]) => [k, String(val)]),
    );
    return `/screen?${new URLSearchParams(params)}`;
  };

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">企業スクリーニング</h1>
        <p className="mt-1 text-sm text-slate-500">
          ガバナンス・財務指標で企業を絞り込み、投資家別の賛否情報を確認できます。企業行をクリックすると投資家ごとの詳細が展開します。
        </p>
      </div>

      {/* フィルターフォーム */}
      <ScreenerFilterForm investors={investors} currentFilters={filterForm} />

      {/* 結果ヘッダー */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-4">
          <span className="text-sm font-bold text-slate-700">{companyRows.length}社 該当</span>
          <span className="text-sm text-slate-500">
            {totalOppositionCount}件の反対推定（Medium以上）
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            href={buildTabUrl("company")}
            className={`rounded border px-3 py-1.5 text-sm ${
              view === "company" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            企業一覧
          </Link>
          <Link
            href={buildTabUrl("investor")}
            className={`rounded border px-3 py-1.5 text-sm ${
              view === "investor"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            投資家別
          </Link>
        </div>
      </div>

      {/* ── 企業一覧タブ ── */}
      {view === "company" && <ScreenerResultTable rows={companyRows} />}

      {/* ── 投資家別タブ ── */}
      {view === "investor" && (
        <div className="space-y-4">
          {investorOppositions.length === 0 ? (
            <div className="rounded-xl border bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              条件に合う企業への反対推定がありません。
            </div>
          ) : (
            investorOppositions.map(({ investor: inv, items }) => {
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
                      <Link
                        href={`/investors/${inv.investor_id}`}
                        className="font-bold text-slate-900 hover:text-blue-700"
                      >
                        {inv.investor_name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {inv.country} / {inv.investor_type}
                      </p>
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

                  <div className="divide-y">
                    {Array.from(byIssue.entries()).map(([issueKey, issueItems]) => (
                      <div key={issueKey} className="px-5 py-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {issueKey !== "other"
                              ? (issueLabels[issueKey as IssueType] ?? issueKey)
                              : "その他"}
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
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${levelBadgeClass[item.level]}`}
                              >
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
