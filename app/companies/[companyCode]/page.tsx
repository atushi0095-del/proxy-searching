import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompany,
  getCompanyGovernanceMetric,
  getDirectors,
  getFinancialMetrics,
  getGuidelineSources,
  getVoteResults,
  investors,
} from "@/lib/data";
import { runJudgment, issueLabels } from "@/lib/inference";
import { ExportButton } from "@/components/ExportButton";
import { InvestorSelect } from "@/components/InvestorSelect";
import type { InvestorJudgment, IssueAssessment, IssueType, OppositionLevel, VoteResult } from "@/lib/types";
import oppositionFocusRaw from "@/data/generated/opposition_focus_companies.json";

interface Props {
  params: Promise<{ companyCode: string }>;
  searchParams: Promise<{ year?: string; investor?: string; voteView?: VoteView }>;
}

type VoteView = "opposition" | "all" | "exceptions";

const levelClass: Record<OppositionLevel, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  "Medium-High": "bg-orange-100 text-orange-700 border-orange-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low: "bg-gray-100 text-gray-600 border-gray-200",
  "Not likely": "bg-green-50 text-green-700 border-green-200",
};

function Badge({ level }: { level: OppositionLevel }) {
  return <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${levelClass[level]}`}>{level}</span>;
}

function viewHref(companyCode: string, meetingYear: number, investor: string | undefined, voteView: VoteView) {
  const params = new URLSearchParams({ year: String(meetingYear), voteView });
  if (investor) params.set("investor", investor);
  return `/companies/${companyCode}?${params.toString()}`;
}

function VoteViewSelector({
  companyCode,
  meetingYear,
  investor,
  active,
}: {
  companyCode: string;
  meetingYear: number;
  investor?: string;
  active: VoteView;
}) {
  const options: { key: VoteView; label: string; description: string }[] = [
    { key: "opposition", label: "反対のみ", description: "実際の反対行使または反対推定がある行だけを表示" },
    { key: "exceptions", label: "抵触でも賛成", description: "基準抵触があるのに賛成された可能性がある行を確認" },
    { key: "all", label: "全件", description: "賛成・反対・推定をすべて表示" },
  ];

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm font-bold text-slate-800">表示対象</p>
        {options.map((option) => (
          <Link
            key={option.key}
            href={viewHref(companyCode, meetingYear, investor, option.key)}
            scroll={false}
            title={option.description}
            className={`rounded border px-3 py-1.5 text-sm ${
              active === option.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        目的は「この企業で、どの投資家が、どの基準により反対し得るか」を先に見ることです。明示理由がない場合は、FACTと公式ガイドラインから推定として分けて表示します。
      </p>
    </div>
  );
}

function isOppositionIssue(issue: IssueAssessment) {
  return issue.triggered || issue.level !== "Not likely";
}

function actualVoteSummary(votes: VoteResult[]) {
  return {
    against: votes.filter((vote) => vote.vote === "AGAINST"),
    forVotes: votes.filter((vote) => vote.vote === "FOR"),
  };
}

function latestMetricYear(companyCode: string) {
  const years = getFinancialMetrics(companyCode)
    .map((metric) => metric.fiscal_year)
    .filter((value) => Number.isFinite(value));
  return years.length > 0 ? Math.max(...years) : 2025;
}

function InvestorOppositionOverview({
  judgments,
  companyCode,
  meetingYear,
  voteView,
}: {
  judgments: InvestorJudgment[];
  companyCode: string;
  meetingYear: number;
  voteView: VoteView;
}) {
  const rows = judgments.flatMap((judgment) => {
    const votes = getVoteResults(judgment.investor.investor_id).filter((vote) => vote.company_code === companyCode);
    const summary = actualVoteSummary(votes);
    const topCandidates = judgment.opposition_candidates
      .filter((candidate) => candidate.issue_scores.length > 0)
      .sort((a, b) =>
        ({ High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0 }[b.overall_level] ?? 0) -
        ({ High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0 }[a.overall_level] ?? 0)
      );

    return judgment.issue_assessments
      .filter((issue) => voteView === "all" || isOppositionIssue(issue))
      .map((issue) => {
        const candidateNames = topCandidates
          .filter((candidate) => candidate.issue_scores.some((score) => score.issue_type === issue.issue_type))
          .map((candidate) => candidate.director.name);
        const hasActualAgainst = summary.against.length > 0;
        const hasActualFor = summary.forVotes.length > 0;
        const show =
          voteView === "all" ||
          (voteView === "opposition" && (issue.triggered || hasActualAgainst)) ||
          (voteView === "exceptions" && issue.triggered && hasActualFor);

        return show
          ? {
              investor: judgment.investor,
              issue,
              candidates: candidateNames,
              againstCount: summary.against.length,
              forCount: summary.forVotes.length,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  });

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <SectionTitle label="投資家別 反対・推定反対サマリー" tone="inference" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="pb-2 pr-4 font-semibold">投資家</th>
              <th className="pb-2 pr-4 font-semibold">基準</th>
              <th className="pb-2 pr-4 font-semibold">判定</th>
              <th className="pb-2 pr-4 font-semibold">反対対象候補</th>
              <th className="pb-2 font-semibold">考察</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={`${row.investor.investor_id}-${row.issue.issue_type}`} className="align-top">
                <td className="py-3 pr-4 font-semibold text-slate-900">{row.investor.investor_name}</td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/issues/${row.issue.issue_type}?investor=${row.investor.investor_id}`}
                    scroll={false}
                    className="text-blue-700 hover:underline"
                  >
                    {issueLabels[row.issue.issue_type as IssueType] ?? row.issue.issue_type}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    <Badge level={row.issue.level} />
                    {row.againstCount > 0 && <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">実績反対 {row.againstCount}</span>}
                    {row.forCount > 0 && <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">実績賛成 {row.forCount}</span>}
                    {row.againstCount === 0 && row.issue.triggered && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">ガイドライン抵触推定</span>}
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-700">
                  {row.candidates.length > 0 ? row.candidates.join("、") : row.issue.target_candidates.join(", ")}
                </td>
                <td className="py-3 text-xs leading-5 text-slate-600">
                  {row.issue.triggered && row.forCount > 0
                    ? "基準には抵触している可能性がありますが、賛成実績もあります。改善計画、例外的な会社事情、候補者の役割差、投資家側の定性判断が入った可能性として確認対象です。"
                    : row.issue.triggered
                    ? row.issue.inference
                    : "現時点では反対に直結するFACTは弱く、賛成事例側の比較対象として扱います。"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          現在の表示条件では、反対行使または反対推定に該当する行はありません。
        </p>
      )}
    </section>
  );
}

function SectionTitle({ label, tone }: { label: string; tone: "fact" | "guideline" | "inference" | "warning" }) {
  const styles = {
    fact: "border-slate-400 bg-slate-50 text-slate-900",
    guideline: "border-blue-400 bg-blue-50 text-blue-900",
    inference: "border-amber-400 bg-amber-50 text-amber-900",
    warning: "border-gray-300 bg-gray-50 text-gray-700",
  };
  return <h2 className={`mb-3 rounded-r border-l-4 px-3 py-2 text-sm font-bold ${styles[tone]}`}>{label}</h2>;
}

function InvestorPanel({ judgment, voteView }: { judgment: InvestorJudgment; voteView: VoteView }) {
  const activeCandidates = judgment.opposition_candidates.filter((candidate) => candidate.issue_scores.length > 0);
  const sources = getGuidelineSources(judgment.investor.investor_id);
  const companyVoteResults = getVoteResults(judgment.investor.investor_id).filter(
    (vr) => vr.company_code === judgment.company.company_code
  );
  const referenceVoteResults = getVoteResults(judgment.investor.investor_id).filter(
    (vr) => vr.company_code.startsWith("SAMPLE")
  );
  const hasTriggeredIssue = judgment.issue_assessments.some(isOppositionIssue);
  const voteResults = voteView === "opposition"
    ? companyVoteResults.filter((vr) => vr.vote === "AGAINST")
    : voteView === "exceptions"
    ? companyVoteResults.filter((vr) => vr.vote === "FOR" && hasTriggeredIssue)
    : companyVoteResults;
  const referenceResults = voteView === "opposition"
    ? referenceVoteResults.filter((vr) => vr.vote === "AGAINST")
    : voteView === "exceptions"
    ? referenceVoteResults.filter((vr) => vr.vote === "FOR")
    : referenceVoteResults;
  const visibleAssessments = voteView === "all"
    ? judgment.issue_assessments
    : judgment.issue_assessments.filter(isOppositionIssue);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-xl font-bold">{judgment.investor.investor_name}</h2>
          <p className="mt-1 text-sm text-slate-500">{judgment.investor.basis_policy}</p>
        </div>
        <Link className="ml-auto rounded border px-3 py-1.5 text-xs text-slate-700" href={`/investors/${judgment.investor.investor_id}`}>
          ルール一覧
        </Link>
      </div>

      <div className="mt-5">
        <SectionTitle label="GUIDELINE 公式ガイドライン / 抵触可能性一覧" tone="guideline" />
        <div className="grid gap-3 md:grid-cols-2">
          {visibleAssessments.map((item, index) => (
            <div key={`${item.issue_type}-${index}`} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{index + 1}. {item.issue_label}</span>
                <Badge level={item.level} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600"><b>FACT:</b> {item.fact}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600"><b>GUIDELINE:</b> {item.guideline}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600"><b>INFERENCE:</b> {item.inference}</p>
              <a className="mt-2 inline-block text-xs text-blue-700 hover:underline" href={item.source_url} target="_blank" rel="noreferrer">
                日本語ガイドライン
              </a>
            </div>
          ))}
          {visibleAssessments.length === 0 && (
            <p className="rounded-lg border bg-green-50 px-3 py-2 text-sm text-green-800">
              現在の表示条件では、反対可能性のある基準は検出されていません。
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle label="INFERENCE 反対対象候補" tone="inference" />
        {activeCandidates.length === 0 ? (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
            現在登録されているFACTでは、反対対象候補は検出されていません。これは「賛成された企業側」の比較データとして蓄積します。
          </p>
        ) : (
          <div className="space-y-3">
            {activeCandidates.map((candidate) => (
              <div key={candidate.director.director_id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{candidate.director.name}</span>
                  <span className="text-sm text-slate-500">{candidate.director.current_title}</span>
                  <Badge level={candidate.overall_level} />
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {candidate.issue_scores.map((score) => (
                    <div key={`${candidate.director.director_id}-${score.issue_type}`} className="rounded bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{score.issue_label}由来</span>
                        <Badge level={score.level} />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">根拠区分: {score.basis}</p>
                      <p className="mt-1 text-xs text-slate-600">{score.comment}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{candidate.overall_comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <SectionTitle label="EVIDENCE 行使実績・参照データ" tone="fact" />

        {/* 当該企業の行使データ */}
        {voteResults.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">当該企業の行使結果（推定含む）</p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">候補者</th>
                    <th className="px-3 py-2 text-left font-semibold">年度</th>
                    <th className="px-3 py-2 text-left font-semibold">行使</th>
                    <th className="px-3 py-2 text-left font-semibold">理由</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {voteResults.map((vr) => (
                    <tr key={vr.vote_result_id} className="align-top">
                      <td className="px-3 py-2 font-medium text-slate-900">{vr.director_name}</td>
                      <td className="px-3 py-2 text-slate-600">{vr.meeting_year}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 font-semibold ${
                          vr.vote === "AGAINST"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {vr.vote === "AGAINST" ? "反対" : "賛成"}
                        </span>
                      </td>
                      <td className="px-3 py-2 leading-5 text-slate-600 max-w-xs">{vr.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-400">{voteResults[0]?.notes ?? ""}</p>
          </div>
        )}

        {/* 参考事例（匿名） */}
        {referenceResults.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">参考事例（匿名化・類似パターン）</p>
            <div className="space-y-2">
              {referenceResults.map((vr) => (
                <div key={vr.vote_result_id} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-xs">
                  <span className={`shrink-0 rounded px-2 py-0.5 font-semibold ${
                    vr.vote === "AGAINST" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}>
                    {vr.vote === "AGAINST" ? "反対" : "賛成"}
                  </span>
                  <div>
                    <p className="font-medium text-slate-700">{vr.director_name}（{vr.meeting_year}年）</p>
                    <p className="mt-0.5 text-slate-500">{vr.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 出典リンク */}
        <div className="grid gap-2 md:grid-cols-2">
          {sources.map((source) => (
            <a key={source.source_id} className="rounded border px-3 py-2 text-sm text-blue-700 hover:bg-blue-50" href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
          ))}
        </div>
      </div>

      <SectionTitle label="注意事項" tone="warning" />
      <p className="text-xs leading-5 text-slate-500">{judgment.disclaimer}</p>
    </section>
  );
}

// ── 実際の反対事例データ（opposition_focus_companies.json より）
type FocusExample = { investor_id: string; issue_type: string; meeting_date: string; proposal_type: string; reason: string; source_url: string };
type FocusCompany = { company_code: string; company_name: string; against_count: number; for_count?: number; investors: Record<string, { against: number; for: number } | number>; issues: Record<string, number>; recent_against?: FocusExample[]; recent_examples?: FocusExample[] };
const focusMap = new Map<string, FocusCompany>(
  ((oppositionFocusRaw as unknown as { companies: FocusCompany[] }).companies ?? []).map(c => [c.company_code, c])
);

export default async function CompanyPage({ params, searchParams }: Props) {
  const { companyCode } = await params;
  const { year, investor, voteView: rawVoteView } = await searchParams;
  const meetingYear = year ? Number(year) : latestMetricYear(companyCode);
  const voteView: VoteView =
    rawVoteView === "all" || rawVoteView === "exceptions" || rawVoteView === "opposition"
      ? rawVoteView
      : "opposition";
  const company = getCompany(companyCode)!;
  if (!company) notFound();

  // 実際の反対事例
  const focusData = focusMap.get(companyCode) ?? null;

  const directorList = getDirectors(companyCode, meetingYear);
  const metrics = getFinancialMetrics(companyCode).filter((metric) => metric.fiscal_year <= meetingYear);
  const governance = getCompanyGovernanceMetric(companyCode, meetingYear);
  const targetInvestors = investor ? investors.filter((item) => item.investor_id === investor) : investors;
  const judgments = targetInvestors
    .map((item) => runJudgment(item.investor_id, companyCode, meetingYear))
    .filter((item): item is InvestorJudgment => item !== null);

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">ホーム</Link> / {company.company_name}
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold">{company.company_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-slate-500">{company.company_code}</span>
              {company.market && (
                <span className={`rounded border px-2 py-0.5 text-xs font-medium ${
                  company.market === "東証プライム" ? "border-blue-200 bg-blue-50 text-blue-700"
                  : company.market === "東証スタンダード" ? "border-green-200 bg-green-50 text-green-700"
                  : company.market === "東証グロース" ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>{company.market}</span>
              )}
              {company.topix_component === true && (
                <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">TOPIX構成</span>
              )}
              <span className="text-sm text-slate-500">{company.sector}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              決算期: {company.fiscal_year_end}月 / 対象年度: {meetingYear}
            </p>
          </div>
          <a className="ml-auto rounded border px-3 py-1.5 text-xs text-slate-700" href={company.source_url} target="_blank" rel="noreferrer">
            企業IR
          </a>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <SectionTitle label="FACT 事実データ" tone="fact" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">直近3期 財務指標</h3>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {metrics.slice(-3)[0]?.fiscal_year ?? "-"} - {metrics.slice(-3).at(-1)?.fiscal_year ?? "-"}
              </span>
            </div>
            {metrics.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">財務データは未登録です。有価証券報告書から順次追加予定です。</p>
            ) : (
              <div className="mt-3 space-y-2">
                {metrics.slice(-3).map((metric) => (
                  <div key={metric.fiscal_year} className="rounded bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="font-semibold">{metric.fiscal_year}年度</span>
                      <span className="text-xs">
                        ROE <strong className={metric.roe != null && metric.roe < 5 ? "text-red-600" : ""}>{metric.roe?.toFixed(1) ?? "—"}%</strong>
                        {" / "}
                        PBR <strong>{metric.pbr?.toFixed(2) ?? "—"}</strong>
                        {metric.tsr_3y_rank_percentile != null && (
                          <>{" / "}TSR順位 <strong>{metric.tsr_3y_rank_percentile.toFixed(0)}%ile</strong></>
                        )}
                      </span>
                    </div>
                    {metric.notes && (
                      <div className="mt-1 flex items-start justify-between gap-3 text-xs text-slate-500">
                        <span className="leading-4">{metric.notes}</span>
                        {metric.source_url && (
                          <a className="shrink-0 text-blue-700 hover:underline" href={metric.source_url} target="_blank" rel="noreferrer">
                            出典
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-400">
              判定は対象年度以下の直近3期を使用。翌年データが追加されると1年分スライドします。ROE赤字は5%未満を示します。
            </p>
          </div>
          <div className="rounded-lg border p-4 md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">取締役会構成</h3>
              {governance?.source_url && (
                <a href={governance.source_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                  ソース
                </a>
              )}
            </div>
            {governance ? (
              <>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">取締役数</p>
                    <p className="text-lg font-bold">{governance.board_size}</p>
                    <p className="text-xs text-slate-400">社内{governance.inside_director_count} / 社外{governance.outside_director_count}</p>
                  </div>
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">独立社外比率</p>
                    <p className="text-lg font-bold">{governance.independent_director_ratio.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400">{governance.independent_director_count}名</p>
                  </div>
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">女性取締役</p>
                    <p className="text-lg font-bold">{governance.female_director_count}名</p>
                    <p className="text-xs text-slate-400">{governance.female_director_ratio.toFixed(1)}%</p>
                  </div>
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">独立議長</p>
                    <p className="text-lg font-bold">{governance.has_independent_board_chair ? "あり" : "なし"}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded px-2 py-1 font-semibold ${governance.has_nominating_committee ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    指名委員会: {governance.has_nominating_committee ? "あり" : "なし"}
                  </span>
                  <span className={`rounded px-2 py-1 font-semibold ${governance.has_compensation_committee ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    報酬委員会: {governance.has_compensation_committee ? "あり" : "なし"}
                  </span>
                  {governance.policy_shareholdings_ratio != null && (
                    <span className="rounded bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                      政策保有株式: {governance.policy_shareholdings_ratio.toFixed(1)}%
                    </span>
                  )}
                </div>
                {governance.notes && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">{governance.notes}</p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                取締役会構成データは未登録です。招集通知・CG報告書から順次追加予定です。
              </p>
            )}
          </div>
        </div>

        {directorList.length === 0 ? (
          <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            この企業の取締役候補者データはまだ登録されていません。招集通知・有価証券報告書からの取り込みを予定しています。
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {directorList.map((director) => (
              <div key={director.director_id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{director.name}</p>
                    <p className="text-sm leading-5 text-slate-500">{director.current_title}</p>
                  </div>
                  {director.source_url && !director.source_url.includes("example.com") && (
                    director.source_url.toLowerCase().endsWith(".pdf") ? (
                      <a href={director.source_url} target="_blank" rel="noreferrer"
                        className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100">
                        📄 招集通知
                      </a>
                    ) : (
                      <a href={director.source_url} target="_blank" rel="noreferrer"
                        className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100">
                        🔗 IRページ
                      </a>
                    )
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  {/* 役職 */}
                  {director.is_president && (
                    <span className="rounded border border-rose-200 bg-rose-100 px-2 py-0.5 font-medium text-rose-700">社長</span>
                  )}
                  {(director.is_chair ?? false) && (
                    <span className="rounded border border-purple-200 bg-purple-100 px-2 py-0.5 font-medium text-purple-700">会長</span>
                  )}
                  {(director.is_ceo ?? false) && (
                    <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700">CEO</span>
                  )}
                  {/* 代表権 */}
                  {director.has_representative_authority && (
                    <span className="rounded border border-amber-200 bg-amber-100 px-2 py-0.5 font-medium text-amber-700">代表取締役</span>
                  )}
                  {/* 社外・独立 */}
                  {director.is_outside_director && (
                    <span className="rounded border border-sky-200 bg-sky-100 px-2 py-0.5 text-sky-700">社外</span>
                  )}
                  {(director.is_independent ?? director.is_outside_director) && director.is_outside_director && (
                    <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-green-700">独立</span>
                  )}
                  {!director.is_outside_director && !(director.is_chair ?? false) && !director.is_president && !(director.is_ceo ?? false) && (
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">社内</span>
                  )}
                  {/* 委員会 */}
                  {director.is_board_chair && (
                    <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">取締役会議長</span>
                  )}
                  {(director.is_nominating_committee_chair ?? false) && (
                    <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700">指名委員長</span>
                  )}
                  {/* 性別 */}
                  {director.is_female && (
                    <span className="rounded border border-pink-200 bg-pink-50 px-2 py-0.5 text-pink-700">女性</span>
                  )}
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                  <p>
                    在任: 現在{director.tenure_years_before_meeting ?? (director as unknown as Record<string,unknown>)["tenure_years"] ?? "-"}年
                    {director.tenure_years_after_reelection != null ? ` / 再任後${director.tenure_years_after_reelection}年` : ""}
                  </p>
                  <p>
                    出席率: {director.board_attendance_rate != null ? `${director.board_attendance_rate}%` : "未登録"}
                    {director.outside_board_seats != null && director.outside_board_seats > 0 ? ` / 社外兼職: ${director.outside_board_seats}社` : ""}
                    {director.listed_company_board_seats != null && director.listed_company_board_seats > 1 ? ` (上場${director.listed_company_board_seats}社)` : ""}
                  </p>
                  {director.notes && <p className="leading-4 text-slate-400">{director.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <VoteViewSelector
        companyCode={company.company_code}
        meetingYear={meetingYear}
        investor={investor}
        active={voteView}
      />

      <div className="flex flex-wrap items-center gap-3">
        <InvestorSelect
          investors={investors}
          companyCode={company.company_code}
          meetingYear={meetingYear}
          selectedInvestor={investor}
          voteView={voteView}
        />
        <div className="ml-auto">
          <ExportButton judgments={judgments} companyCode={companyCode} meetingYear={meetingYear} />
        </div>
      </div>

      {!investor && (
        <InvestorOppositionOverview
          judgments={judgments}
          companyCode={company.company_code}
          meetingYear={meetingYear}
          voteView={voteView}
        />
      )}

      {/* 投資家横断サマリー（全投資家表示時のみ） */}
      {false && !investor && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <SectionTitle label="INFERENCE 投資家別 反対可能性サマリー" tone="inference" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4 font-semibold">投資家</th>
                  <th className="pb-2 pr-4 font-semibold">抵触論点</th>
                  <th className="pb-2 pr-4 font-semibold">反対対象候補</th>
                  <th className="pb-2 font-semibold">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {judgments.map((j) => {
                  const triggeredIssues = j.issue_assessments.filter((a) => a.triggered);
                  const topCandidates = j.opposition_candidates
                    .filter((c) => c.issue_scores.length > 0)
                    .sort((a, b) =>
                      ({ High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0 }[b.overall_level] ?? 0) -
                      ({ High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0 }[a.overall_level] ?? 0)
                    );
                  return (
                    <tr key={j.investor.investor_id} className="align-top">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{j.investor.investor_name}</p>
                      </td>
                      <td className="py-3 pr-4">
                        {triggeredIssues.length === 0 ? (
                          <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                            抵触なし
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {triggeredIssues.map((a) => (
                              <Link
                                key={a.issue_type}
                                href={`/issues/${a.issue_type}?investor=${j.investor.investor_id}`}
                                className={`rounded border px-2 py-0.5 text-xs font-semibold hover:opacity-80 ${
                                  a.level === "High"
                                    ? "bg-red-100 text-red-700 border-red-200"
                                    : a.level === "Medium-High"
                                    ? "bg-orange-100 text-orange-700 border-orange-200"
                                    : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                }`}
                              >
                                {issueLabels[a.issue_type as IssueType] ?? a.issue_type}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {topCandidates.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {topCandidates.slice(0, 3).map((c) => (
                              <span
                                key={c.director.director_id}
                                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${levelClass[c.overall_level]}`}
                              >
                                {c.director.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/companies/${company.company_code}?year=${meetingYear}&investor=${j.investor.investor_id}`}
                          className="rounded border px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
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
          <p className="mt-3 text-xs text-slate-400">
            ※ 論点バッジをクリックすると、その基準の企業横断ビューへ移動します。
          </p>
        </section>
      )}

      {/* ── 実際の行使実績（opposition_focus_companies.json より） */}
      {focusData && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-bold text-slate-800">📋 実際の行使実績（複数投資家）</h2>
            <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">反対 {focusData.against_count}件</span>
            {focusData.for_count != null && focusData.for_count > 0 && (
              <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">賛成 {focusData.for_count}件</span>
            )}
            <span className="ml-auto text-xs text-slate-400">週次自動更新</span>
          </div>

          {/* 投資家別内訳 */}
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(focusData.investors).map(([invId, counts]) => {
              const against = typeof counts === "number" ? counts : counts.against;
              const forCount = typeof counts === "number" ? 0 : counts.for;
              const inv = investors.find(i => i.investor_id === invId);
              return (
                <Link
                  key={invId}
                  href={`/companies/${companyCode}?year=${meetingYear}&investor=${invId}`}
                  className="flex items-center gap-1.5 rounded border bg-slate-50 px-2.5 py-1.5 text-xs hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="font-medium text-slate-700">{inv?.investor_name ?? invId}</span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">反対{against}</span>
                  {forCount > 0 && <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">賛成{forCount}</span>}
                </Link>
              );
            })}
          </div>

          {/* 論点内訳 */}
          {Object.keys(focusData.issues).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Object.entries(focusData.issues).sort((a, b) => b[1] - a[1]).map(([issue, count]) => (
                <Link
                  key={issue}
                  href={`/issues/${issue}`}
                  className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700 hover:border-orange-300"
                >
                  {issueLabels[issue as IssueType] ?? issue} <span className="font-semibold">{count}</span>
                </Link>
              ))}
            </div>
          )}

          {/* 直近の反対事例 */}
          {(focusData.recent_against ?? focusData.recent_examples ?? []).length > 0 && (
            <div className="rounded border bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">直近の反対事例</p>
              <div className="space-y-2">
                {(focusData.recent_against ?? focusData.recent_examples ?? []).map((ex, i) => {
                  const inv = investors.find(inv => inv.investor_id === ex.investor_id);
                  return (
                    <div key={i} className="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {inv?.investor_name ?? ex.investor_id}
                        </span>
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">
                          {issueLabels[ex.issue_type as IssueType] ?? ex.issue_type}
                        </span>
                        <span className="text-[10px] text-slate-400">{ex.meeting_date}</span>
                        <span className="text-[10px] text-slate-400">{ex.proposal_type}</span>
                      </div>
                      {ex.reason && <p className="text-xs text-slate-600">{ex.reason}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {judgments.map((judgment) => (
        <InvestorPanel key={judgment.investor.investor_id} judgment={judgment} voteView={voteView} />
      ))}
    </div>
  );
}
