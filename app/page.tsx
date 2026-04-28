import Link from "next/link";
import { AggregatedRulesTable } from "@/components/AggregatedRulesTable";
import type { AggregatedIssueRow } from "@/components/AggregatedRulesTable";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { SearchBox } from "@/components/SearchBox";
import { companies, financialMetrics, getGuidelineRules, investors } from "@/lib/data";
import { issueLabels, issueTaxonomy } from "@/lib/inference";
import type { GuidelineRule, IssueType } from "@/lib/types";
import oppositionSummary from "@/data/generated/investor_opposition_summary.json";

const countryLabels: Record<string, string> = {
  Japan: "日本",
  US: "米国",
};

const investorTypeShort: Record<string, string> = {
  "Asset manager": "AM",
  "Trust bank": "信託",
  "Trust bank / asset manager": "信託/AM",
};

function thresholdSummary(rules: GuidelineRule[]): string {
  const vals = rules
    .filter((r) => r.threshold_value != null)
    .map((r) => Number(r.threshold_value));
  if (vals.length === 0) return "定性";
  const unit = rules.find((r) => r.threshold_unit)?.threshold_unit ?? "";
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  return mn === mx ? `${mn}${unit}` : `${mn}〜${mx}${unit}`;
}

export default function HomePage() {
  const mainRules = investors.flatMap((investor) => getGuidelineRules(investor.investor_id));
  const latestYear = Math.max(...financialMetrics.map((m) => m.fiscal_year), 2025);

  // ルール数（投資家別）
  const ruleCountByInvestor = new Map<string, number>();
  for (const rule of mainRules) {
    ruleCountByInvestor.set(rule.investor_id, (ruleCountByInvestor.get(rule.investor_id) ?? 0) + 1);
  }

  // 論点別ルール集約
  const rulesByIssue = new Map<string, GuidelineRule[]>();
  for (const rule of mainRules) {
    const arr = rulesByIssue.get(rule.issue_type) ?? [];
    arr.push(rule);
    rulesByIssue.set(rule.issue_type, arr);
  }

  const againstByIssue = oppositionSummary.against_by_issue as Record<string, number>;

  const aggregatedRows: AggregatedIssueRow[] = issueTaxonomy.map((item) => ({
    issueType: item.issue_type as IssueType,
    issueLabel: item.issue,
    category: item.category,
    investorCount: (rulesByIssue.get(item.issue_type) ?? []).length,
    thresholdSummary: thresholdSummary(rulesByIssue.get(item.issue_type) ?? []),
    againstCount: againstByIssue[item.issue_type] ?? 0,
    rules: rulesByIssue.get(item.issue_type) ?? [],
  }));

  const searchCompanies = companies.map((c) => ({
    code: c.company_code,
    name: c.company_name,
    market: c.market,
    sector: c.sector,
  }));

  const searchInvestors = investors.map((inv) => ({
    id: inv.investor_id,
    name: inv.investor_name,
    country: inv.country,
    type: inv.investor_type,
  }));

  const searchRules = mainRules.map((rule) => ({
    ruleId: rule.rule_id,
    investorId: rule.investor_id,
    investorName: investors.find((inv) => inv.investor_id === rule.investor_id)?.investor_name ?? rule.investor_id,
    issueType: rule.issue_type,
    issueLabel: issueLabels[rule.issue_type as IssueType],
    category: rule.issue_category,
    conditionText: rule.condition_text,
    summaryText: rule.summary_text,
  }));

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="rounded-xl border bg-white px-6 py-4 shadow-sm">
        <p className="text-xs font-semibold text-blue-700">SR/IR向け 分析支援ツール</p>
        <h1 className="mt-0.5 text-xl font-bold">議決権行使 反対パターン推定</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          投資家別ガイドライン、過去行使結果、企業FACT、候補者属性を横断確認します。
          FACT / GUIDELINE / INFERENCE を明確に分け、断定しない形で分析を支援します。
        </p>
      </section>

      {/* データ状況 */}
      <ProgressDashboard />

      {/* 横断検索 */}
      <section className="rounded-xl border bg-white px-5 py-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-600">横断検索</p>
        <SearchBox companies={searchCompanies} investors={searchInvestors} rules={searchRules} />
      </section>

      {/* 投資家一覧 */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">投資家一覧</h2>
          <span className="text-xs text-slate-500">{investors.length}社登録済み</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {investors.map((investor) => {
            const ruleCount = ruleCountByInvestor.get(investor.investor_id) ?? 0;
            const countryLabel = countryLabels[investor.country] ?? investor.country;
            const typeLabel = investorTypeShort[investor.investor_type] ?? investor.investor_type;
            return (
              <Link
                key={investor.investor_id}
                href={`/investors/${investor.investor_id}`}
                className="flex flex-col gap-1 rounded-lg border bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
              >
                <span className="text-xs text-slate-400">{countryLabel} / {typeLabel}</span>
                <span className="text-sm font-semibold leading-snug text-slate-900">{investor.investor_name}</span>
                <span className="self-start rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {ruleCount}ルール
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 対象企業 */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">対象企業</h2>
          <span className="text-xs text-slate-500">{companies.length}社 / {latestYear}年基準</span>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">コード</th>
                <th className="px-3 py-2 text-left font-semibold">社名</th>
                <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">市場 / 業種</th>
                <th className="px-3 py-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.map((company) => (
                <tr key={company.company_code} className="transition hover:bg-blue-50/40">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{company.company_code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{company.company_name}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className={`rounded border px-1.5 py-px text-[10px] font-medium ${
                        company.market === "東証プライム" ? "border-blue-200 bg-blue-50 text-blue-700"
                        : company.market === "東証スタンダード" ? "border-green-200 bg-green-50 text-green-700"
                        : company.market === "東証グロース" ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}>{company.market}</span>
                      {company.topix_component && (
                        <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-px text-[10px] font-medium text-indigo-700">TOPIX</span>
                      )}
                      <span className="text-xs text-slate-500">{company.sector}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/companies/${company.company_code}?year=${latestYear}`}
                      className="rounded border px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      詳細 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 主な基準サマリー */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-800">主な基準サマリー</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              行をクリックで投資家別ルール詳細・反対実績を確認。「詳細→」で論点ページへ。
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {mainRules.length}ルール / {aggregatedRows.filter((r) => r.investorCount > 0).length}論点
          </span>
        </div>
        <AggregatedRulesTable rows={aggregatedRows} />
      </section>
    </div>
  );
}
