import Link from "next/link";
import { GuidelineRuleModalList } from "@/components/GuidelineRuleModalList";
import { IssueTaxonomyModalList } from "@/components/IssueTaxonomyModalList";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { SearchBox } from "@/components/SearchBox";
import { companies, financialMetrics, getGuidelineRules, investors } from "@/lib/data";
import { issueLabels, issueTaxonomy } from "@/lib/inference";

export default function HomePage() {
  const mainRules = investors.flatMap((investor) => getGuidelineRules(investor.investor_id));
  const latestYear = Math.max(...financialMetrics.map((metric) => metric.fiscal_year), 2025);

  const searchCompanies = companies.map((company) => ({
    code: company.company_code,
    name: company.company_name,
    market: company.market,
    sector: company.sector,
  }));

  const searchInvestors = investors.map((investor) => ({
    id: investor.investor_id,
    name: investor.investor_name,
    country: investor.country,
    type: investor.investor_type,
  }));

  const searchRules = mainRules.map((rule) => ({
    ruleId: rule.rule_id,
    investorId: rule.investor_id,
    investorName: investors.find((investor) => investor.investor_id === rule.investor_id)?.investor_name ?? rule.investor_id,
    issueType: rule.issue_type,
    issueLabel: issueLabels[rule.issue_type],
    category: rule.issue_category,
    conditionText: rule.condition_text,
    summaryText: rule.summary_text,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">SR/IR向け 分析支援MVP</p>
        <h1 className="mt-1 text-2xl font-bold">議決権行使 反対パターン推定</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          投資家別ガイドライン、過去行使結果、企業FACT、候補者属性を分けて確認します。
          目的は、抵触基準の解釈と、実際に誰が反対対象になるのかを事例から推定することです。
        </p>
      </section>

      <ProgressDashboard />

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-700">横断検索</h2>
        <SearchBox companies={searchCompanies} investors={searchInvestors} rules={searchRules} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {investors.map((investor) => (
          <Link
            key={investor.investor_id}
            href={`/investors/${investor.investor_id}`}
            className="rounded-xl border bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {investor.country} / {investor.investor_type}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{investor.investor_name}</h2>
            <p className="mt-2 text-sm text-slate-600">{investor.basis_policy}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">対象企業</h2>
          <span className="text-xs text-slate-500">実データシード / {latestYear}年</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {companies.map((company) => (
            <div key={company.company_code} className="rounded-lg border p-4">
              <p className="text-xs font-mono text-slate-500">{company.company_code}</p>
              <h3 className="mt-1 font-bold">{company.company_name}</h3>
              <p className="mt-1 text-sm text-slate-500">{company.market} / {company.sector}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white"
                  href={`/companies/${company.company_code}?year=${latestYear}`}
                >
                  全投資家で見る
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">主な基準一覧</h2>
          <span className="text-xs text-slate-500">クリックで原文メモと日本語リンク</span>
        </div>
        <GuidelineRuleModalList rules={mainRules} />
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">将来拡張用の基準分類</h2>
        <IssueTaxonomyModalList items={issueTaxonomy} rules={mainRules} />
      </section>
    </div>
  );
}
