import Link from "next/link";
import { notFound } from "next/navigation";
import { GuidelineRuleModalList } from "@/components/GuidelineRuleModalList";
import { InvestorAnalysisWorkspace } from "@/components/InvestorAnalysisWorkspace";
import { IssueTaxonomyModalList } from "@/components/IssueTaxonomyModalList";
import { companies, companyGovernanceMetrics, directorRoleHistory, directors, financialMetrics, getGuidelineRules, getGuidelineSources, getInvestor } from "@/lib/data";
import { issueTaxonomy } from "@/lib/inference";
import blackrockVoteSummary from "@/data/generated/blackrock_vote_summary.json";
import mufgVoteSummary from "@/data/generated/mufg_vote_summary.json";
import oppositionRecords from "@/data/generated/investor_opposition_records.json";

interface Props {
  params: Promise<{ investorId: string }>;
}

const investorTypeLabels: Record<string, string> = {
  "Asset manager": "アセットマネージャー",
  "Trust bank": "信託銀行",
};

const countryLabels: Record<string, string> = {
  Japan: "日本",
  US: "米国",
};

const documentTypeLabels: Record<string, string> = {
  guideline: "ガイドライン",
  guideline_changes: "改定情報",
  vote_result: "議決権行使結果",
};

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
        <p className="text-xs font-semibold tracking-wide text-slate-500">投資家ガイドライン</p>
        <h1 className="mt-1 text-2xl font-bold">{investor.investor_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {countryLabels[investor.country] ?? investor.country} / {investorTypeLabels[investor.investor_type] ?? investor.investor_type}
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{investor.basis_policy}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{investor.notes}</p>
      </section>

      <InvestorAnalysisWorkspace
        investorId={investorId}
        records={oppositionRecords.records}
        financialMetrics={financialMetrics}
        governanceMetrics={companyGovernanceMetrics}
        directors={directors}
        roleHistory={directorRoleHistory}
      />

      {investorId === "blackrock" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">BlackRock 行使結果PDFの取込状況</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                BlackRockは行使結果がPDF中心のため、Excel形式の投資家より抽出工程が一段多くなります。
              </p>
            </div>
            <span className="rounded bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {blackrockVoteSummary.parser_status}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">PDFファイル数</p>
              <p className="mt-1 text-2xl font-bold">{blackrockVoteSummary.total_files.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">テキスト層あり</p>
              <p className="mt-1 text-2xl font-bold">{blackrockVoteSummary.text_layer_files.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">次の処理</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">会社・議案・賛否の行単位テーブル化</p>
            </div>
          </div>
          <p className="mt-3 rounded bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
            週次収集ではBlackRockのPDFリンクも対象に追加済みです。PDF取得後、テキスト層を抽出できるものから行使先一覧へ反映します。画像PDFの場合はOCR工程が必要です。
          </p>
        </section>
      )}

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
                <span className="text-xs text-slate-600">{issueLabels[item.issueType] ?? item.issueType}</span>
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
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{documentTypeLabels[source.document_type] ?? source.document_type}</span>
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
