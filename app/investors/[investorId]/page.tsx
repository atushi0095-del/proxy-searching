import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { GuidelineRuleModalList } from "@/components/GuidelineRuleModalList";
import { InvestorAnalysisWorkspace } from "@/components/InvestorAnalysisWorkspace";
import { companyGovernanceMetrics, directorRoleHistory, directors, financialMetrics, getGuidelineRules, getGuidelineSources, getInvestor } from "@/lib/data";
import blackrockVoteSummary from "@/data/generated/blackrock_vote_summary.json";
import mufgVoteSummary from "@/data/generated/mufg_vote_summary.json";

interface Props {
  params: Promise<{ investorId: string }>;
}

async function loadInvestorOppositionRecords(investorId: string): Promise<any[]> {
  const filePath = path.join(process.cwd(), "data", "generated", "opposition_records_by_investor", `${investorId}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as { records?: any[] };
    return parsed.records ?? [];
  } catch {
    return [];
  }
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

export default async function InvestorPage({ params }: Props) {
  const { investorId } = await params;
  const investor = getInvestor(investorId);
  if (!investor) notFound();

  const rules = getGuidelineRules(investorId);
  const sources = getGuidelineSources(investorId);
  const investorRecords = await loadInvestorOppositionRecords(investorId);
  const extractedIssues = Object.entries(mufgVoteSummary.by_issue_type)
    .filter(([key]) => key.endsWith(" / 反対"))
    .map(([key, count]) => ({
      issueType: key.replace(" / 反対", ""),
      count,
    }))
    .filter((item) => item.issueType !== "other")
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">ホーム</Link> / {investor.investor_name}
      </div>

      {/* 投資家ヘッダー */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">
              {countryLabels[investor.country] ?? investor.country} / {investorTypeLabels[investor.investor_type] ?? investor.investor_type}
            </p>
            <h1 className="mt-0.5 text-xl font-bold">{investor.investor_name}</h1>
          </div>
          {rules.length > 0 && (
            <span className="rounded bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {rules.length}ルール登録済み
            </span>
          )}
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{investor.basis_policy}</p>
        {investor.notes && <p className="mt-2 text-sm leading-6 text-slate-500">{investor.notes}</p>}
      </section>

      {/* 行使結果・分析ワークスペース */}
      <InvestorAnalysisWorkspace
        investorId={investorId}
        records={investorRecords}
        financialMetrics={financialMetrics}
        governanceMetrics={companyGovernanceMetrics}
        directors={directors}
        roleHistory={directorRoleHistory}
      />

      {/* 投資家固有: BlackRock PDF取込状況 */}
      {investorId === "blackrock" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">BlackRock 行使結果PDFの取込状況</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                BlackRockは行使結果がPDF中心のため、Excel形式の投資家より抽出工程が一段多くなります。
              </p>
            </div>
            <span className="rounded bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {blackrockVoteSummary.parser_status}
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">PDFファイル数</p>
              <p className="mt-1 text-xl font-bold">{blackrockVoteSummary.total_files.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">テキスト層あり</p>
              <p className="mt-1 text-xl font-bold">{blackrockVoteSummary.text_layer_files.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">次の処理</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">会社・議案・賛否の行単位テーブル化</p>
            </div>
          </div>
        </section>
      )}

      {/* 投資家固有: 三菱UFJ信託 実データサマリー */}
      {investorId === "mufg_trust" && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">実データ抽出サマリー</h2>
            <span className="text-xs text-slate-500">
              {mufgVoteSummary.total_records.toLocaleString()}件
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">賛成</p>
              <p className="mt-1 text-xl font-bold text-green-700">{mufgVoteSummary.by_vote["賛成"].toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">反対</p>
              <p className="mt-1 text-xl font-bold text-red-700">{mufgVoteSummary.by_vote["反対"].toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-500">対象期間</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">2017年5月〜2025年12月</p>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5 md:grid-cols-2">
            {extractedIssues.slice(0, 8).map((item) => (
              <div key={item.issueType} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs">
                <span className="text-slate-600">{issueLabels[item.issueType] ?? item.issueType}</span>
                <span className="font-semibold text-slate-900">{item.count.toLocaleString()}件</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ガイドラインソース */}
      {sources.length > 0 && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">ガイドラインソース</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">種別</th>
                  <th className="px-3 py-2 text-left font-semibold">年</th>
                  <th className="px-3 py-2 text-left font-semibold">タイトル</th>
                  <th className="px-3 py-2 text-left font-semibold">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sources.map((source) => (
                  <tr key={source.source_id} className="align-top">
                    <td className="px-3 py-2">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                        {documentTypeLabels[source.document_type] ?? source.document_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{source.year}</td>
                    <td className="px-3 py-2">
                      <a className="text-blue-700 hover:underline" href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{source.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 基準一覧 */}
      {rules.length > 0 && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">基準一覧</h2>
            <span className="text-xs text-slate-400">行クリックで詳細・原文メモを表示</span>
          </div>
          <GuidelineRuleModalList rules={rules} />
        </section>
      )}
    </div>
  );
}
