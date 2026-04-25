import Link from "next/link";
import { notFound } from "next/navigation";
import { GuidelineRuleModalList } from "@/components/GuidelineRuleModalList";
import { InvestorAnalysisWorkspace } from "@/components/InvestorAnalysisWorkspace";
import { IssueTaxonomyModalList } from "@/components/IssueTaxonomyModalList";
import { companies, financialMetrics, getGuidelineRules, getGuidelineSources, getInvestor } from "@/lib/data";
import { issueTaxonomy } from "@/lib/inference";
import mufgVoteSummary from "@/data/generated/mufg_vote_summary.json";
import oppositionRecords from "@/data/generated/investor_opposition_records.json";

interface Props {
  params: Promise<{ investorId: string }>;
}

export default async function InvestorPage({ params }: Props) {
  const { investorId } = await params;
  const investor = getInvestor(investorId);
  if (!investor) notFound();

  const rules = getGuidelineRules(investorId);
  const sources = getGuidelineSources(investorId);
  const extractedIssues = Object.entries(mufgVoteSummary.by_issue_type)
    .filter(([key]) => key.endsWith(" / 反対"))
    .map(([key, count]) => ({
      issueType: key.replace(" / 反対", ""),
      count,
    }))
    .filter((item) => item.issueType !== "other")
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">ホーム</Link> / {investor.investor_name}
      </div>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investor Guideline</p>
        <h1 className="mt-1 text-2xl font-bold">{investor.investor_name}</h1>
        <p className="mt-1 text-sm text-slate-500">{investor.country} / {investor.investor_type}</p>
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{investor.basis_policy}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{investor.notes}</p>
      </section>

      <InvestorAnalysisWorkspace
        investorId={investorId}
        records={oppositionRecords.records}
        financialMetrics={financialMetrics}
      />

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">分析対象企業</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {companies.map((company) => (
            <Link
              key={company.company_code}
              href={`/companies/${company.company_code}?year=2025&investor=${investorId}`}
              className="rounded-lg border p-4 transition hover:border-blue-300 hover:bg-blue-50/30"
            >
              <p className="font-semibold">{company.company_name}</p>
              <p className="mt-1 text-xs text-slate-500">{company.company_code} / {company.market} / {company.sector}</p>
            </Link>
          ))}
        </div>
      </section>

      {investorId === "mufg_trust" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">実データ抽出サマリー</h2>
            <span className="text-xs text-slate-500">
              三菱UFJ信託銀行 個別議案別行使結果 / {mufgVoteSummary.total_records.toLocaleString()}件
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">賛成</p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                {mufgVoteSummary.by_vote["賛成"].toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">反対</p>
              <p className="mt-1 text-2xl font-bold text-red-700">
                {mufgVoteSummary.by_vote["反対"].toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">抽出対象期間</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">2017年5月～2025年12月総会</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {extractedIssues.slice(0, 8).map((item) => (
              <div key={item.issueType} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-mono text-xs text-slate-600">{item.issueType}</span>
                <span className="font-semibold text-slate-900">{item.count.toLocaleString()}件</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            反対理由テキストから論点を機械分類した中間結果です。次工程では、同一企業内の賛成候補者と反対候補者を照合し、在任期間12年の境界や反対対象を推定します。
          </p>
        </section>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">日本語ソース</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {sources.map((source) => (
            <div key={source.source_id} className="rounded-lg border px-4 py-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{source.document_type}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{source.year}</span>
                <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">日本語</span>
              </div>
              <a className="mt-2 block text-blue-700 hover:underline" href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
              {source.notes && <p className="mt-1 text-xs text-slate-500">{source.notes}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">主な基準一覧</h2>
          <span className="text-xs text-slate-500">クリックで基準内容・原文メモ・日本語リンクを表示</span>
        </div>
        <GuidelineRuleModalList rules={rules} />
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">将来拡張用の基準分類</h2>
        <IssueTaxonomyModalList items={issueTaxonomy} rules={rules} />
      </section>
    </div>
  );
}
