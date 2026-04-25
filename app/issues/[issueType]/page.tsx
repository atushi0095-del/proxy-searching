import Link from "next/link";
import { notFound } from "next/navigation";
import { companies, guidelineRules, investors } from "@/lib/data";
import { runJudgment, issueLabels, issueTaxonomy } from "@/lib/inference";
import type { IssueType, OppositionLevel } from "@/lib/types";

interface Props {
  params: Promise<{ issueType: string }>;
  searchParams: Promise<{ investor?: string }>;
}

const MEETING_YEAR = 2025;

const levelClass: Record<OppositionLevel, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  "Medium-High": "bg-orange-100 text-orange-700 border-orange-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low: "bg-gray-100 text-gray-600 border-gray-200",
  "Not likely": "bg-green-50 text-green-700 border-green-200",
};

const levelJa: Record<OppositionLevel, string> = {
  High: "反対可能性：高",
  "Medium-High": "反対可能性：中高",
  Medium: "反対可能性：中",
  Low: "反対可能性：低",
  "Not likely": "反対なし",
};

function levelWeight(level: OppositionLevel): number {
  return { High: 4, "Medium-High": 3, Medium: 2, Low: 1, "Not likely": 0 }[level];
}

function Badge({ level, short = false }: { level: OppositionLevel; short?: boolean }) {
  const label = short
    ? { High: "高", "Medium-High": "中高", Medium: "中", Low: "低", "Not likely": "—" }[level]
    : levelJa[level];
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${levelClass[level]}`}>
      {label}
    </span>
  );
}

// ─── 投資家概要モード ───────────────────────────────────────────────────────────
function InvestorOverview({
  issueType,
  investorsWithRule,
}: {
  issueType: IssueType;
  investorsWithRule: (typeof investors)[number][];
}) {
  return (
    <section>
      <h2 className="mb-4 rounded-r border-l-4 border-blue-400 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900">
        GUIDELINE この基準を持つ投資家（{investorsWithRule.length}社）
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {investorsWithRule.map((inv) => {
          const rule = guidelineRules.find(
            (r) => r.investor_id === inv.investor_id && r.issue_type === issueType
          );
          // その投資家でこの論点が抵触する企業数をカウント
          const triggeredCount = companies.filter((co) => {
            const j = runJudgment(inv.investor_id, co.company_code, MEETING_YEAR);
            return j?.issue_assessments.find((a) => a.issue_type === issueType)?.triggered;
          }).length;

          return (
            <Link
              key={inv.investor_id}
              href={`/issues/${issueType}?investor=${inv.investor_id}`}
              className="block rounded-xl border bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-blue-700 transition">
                    {inv.investor_name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{inv.basis_policy}</p>
                </div>
                <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  抵触 {triggeredCount}社
                </span>
              </div>

              {rule && (
                <div className="mt-3 space-y-1.5 text-xs leading-5">
                  <p className="font-semibold text-slate-700">{rule.summary_text}</p>
                  <p className="text-slate-500">{rule.condition_text}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-slate-500">
                    {rule.threshold_value != null && (
                      <span>閾値: <strong>{rule.threshold_value}{rule.threshold_unit}</strong></span>
                    )}
                    {rule.lookback_years && (
                      <span>参照期間: <strong>{rule.lookback_years}期</strong></span>
                    )}
                    <span>確信度: <strong>{rule.confidence}</strong></span>
                  </div>
                </div>
              )}

              <p className="mt-3 text-right text-xs text-blue-600 group-hover:underline">
                企業一覧を見る →
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── 投資家別企業一覧モード ────────────────────────────────────────────────────
function InvestorCompanyList({
  issueType,
  selectedInvestorId,
}: {
  issueType: IssueType;
  selectedInvestorId: string;
}) {
  const relevantRules = guidelineRules.filter(
    (r) => r.investor_id === selectedInvestorId && r.issue_type === issueType
  );
  const selectedInvestor = investors.find((inv) => inv.investor_id === selectedInvestorId);

  type CompanyRow = {
    company: (typeof companies)[number];
    triggered: boolean;
    level: OppositionLevel;
    fact: string;
    inference: string;
    oppositionCandidates: { name: string; role: string; level: OppositionLevel }[];
  };

  const rows: CompanyRow[] = companies
    .map((company) => {
      const j = runJudgment(selectedInvestorId, company.company_code, MEETING_YEAR);
      const assessment = j?.issue_assessments.find((a) => a.issue_type === issueType);
      const candidates = (j?.opposition_candidates ?? [])
        .filter((c) => c.issue_scores.some((s) => s.issue_type === issueType))
        .map((c) => {
          const score = c.issue_scores.find((s) => s.issue_type === issueType)!;
          return { name: c.director.name, role: c.director.current_title, level: score.level };
        });

      return {
        company,
        triggered: assessment?.triggered ?? false,
        level: assessment?.level ?? "Not likely",
        fact: assessment?.fact ?? "",
        inference: assessment?.inference ?? "",
        oppositionCandidates: candidates,
      };
    })
    .sort((a, b) => levelWeight(b.level) - levelWeight(a.level));

  const triggered = rows.filter((r) => r.triggered);
  const clear = rows.filter((r) => !r.triggered);

  return (
    <>
      {/* 公式ガイドライン */}
      {relevantRules.map((rule) => (
        <section
          key={rule.rule_id}
          className="rounded-xl border-l-4 border-blue-400 bg-blue-50 p-5"
        >
          <h2 className="mb-3 text-sm font-bold text-blue-900">
            GUIDELINE 公式ガイドライン — {selectedInvestor?.investor_name}
          </h2>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-blue-800">{rule.summary_text}</p>
            <p className="text-slate-700 leading-6">{rule.condition_text}</p>
            {rule.original_text && (
              <p className="text-slate-500 text-xs leading-5 italic">{rule.original_text}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-600">
              {rule.threshold_value != null && (
                <span>閾値: <strong>{rule.threshold_value}{rule.threshold_unit}</strong></span>
              )}
              {rule.lookback_years && (
                <span>参照期間: <strong>{rule.lookback_years}期</strong></span>
              )}
              {rule.applies_to && <span>対象: <strong>{rule.applies_to}</strong></span>}
              <span>確信度: <strong>{rule.confidence}</strong></span>
            </div>
            <a
              href={rule.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-blue-700 hover:underline mt-1"
            >
              出典: {rule.source_title} →
            </a>
          </div>
        </section>
      ))}

      {/* 抵触企業 */}
      <section>
        <h2 className="mb-4 rounded-r border-l-4 border-red-400 bg-red-50 px-3 py-2 text-sm font-bold text-red-900">
          INFERENCE 基準抵触の可能性がある企業（{triggered.length}社）
        </h2>
        {triggered.length === 0 ? (
          <p className="rounded bg-white border px-4 py-4 text-sm text-slate-500">
            登録済みデータでは抵触企業は検出されていません。
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {triggered.map(({ company, level, fact, inference, oppositionCandidates }) => (
              <Link
                key={company.company_code}
                href={`/companies/${company.company_code}?year=${MEETING_YEAR}&investor=${selectedInvestorId}`}
                className="block rounded-xl border bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-blue-700 transition">
                      {company.company_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {company.company_code} / {company.sector}
                    </p>
                  </div>
                  <Badge level={level} />
                </div>
                <div className="mt-3 space-y-1.5 text-xs leading-5">
                  <p><span className="font-semibold text-slate-500">FACT:</span> {fact}</p>
                  <p><span className="font-semibold text-amber-700">INFERENCE:</span> {inference}</p>
                </div>
                {oppositionCandidates.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">反対対象候補</p>
                    <div className="flex flex-wrap gap-1.5">
                      {oppositionCandidates.map((c) => (
                        <span
                          key={c.name}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${levelClass[c.level]}`}
                        >
                          {c.name}{c.role ? `（${c.role}）` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-right text-xs text-blue-600 group-hover:underline">
                  詳細を見る →
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 非抵触企業 */}
      {clear.length > 0 && (
        <section>
          <h2 className="mb-4 rounded-r border-l-4 border-green-400 bg-green-50 px-3 py-2 text-sm font-bold text-green-900">
            参考：基準を満たしている企業（{clear.length}社）
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {clear.map(({ company, level, fact }) => (
              <Link
                key={company.company_code}
                href={`/companies/${company.company_code}?year=${MEETING_YEAR}&investor=${selectedInvestorId}`}
                className="block rounded-xl border bg-white p-4 shadow-sm hover:border-green-400 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-green-700 transition text-sm">
                      {company.company_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {company.company_code} / {company.sector}
                    </p>
                  </div>
                  <Badge level={level} />
                </div>
                {fact && (
                  <p className="mt-2 text-xs text-slate-500 leading-5 line-clamp-2">{fact}</p>
                )}
                <p className="mt-2 text-right text-xs text-blue-500 group-hover:underline">詳細 →</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ─── ページ本体 ────────────────────────────────────────────────────────────────
export default async function IssuePage({ params, searchParams }: Props) {
  const { issueType } = await params;
  const { investor: investorParam } = await searchParams;

  if (!(issueType in issueLabels)) notFound();
  const validIssueType = issueType as IssueType;
  const issueLabel = issueLabels[validIssueType];
  const taxonomy = issueTaxonomy.find((t) => t.issue_type === validIssueType);

  // この論点のルールを持つ投資家
  const investorsWithRule = investors.filter((inv) =>
    guidelineRules.some((r) => r.investor_id === inv.investor_id && r.issue_type === validIssueType)
  );

  // 投資家パラメータが有効なら詳細モード、なければ概要モード
  const selectedInvestorId =
    investorParam && investorsWithRule.some((inv) => inv.investor_id === investorParam)
      ? investorParam
      : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="border-b bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <nav className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/" className="hover:text-blue-600">ホーム</Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">基準・議案</span>
            <span>/</span>
            <span className="text-slate-900">{issueLabel}</span>
            {selectedInvestorId && (
              <>
                <span>/</span>
                <span className="text-slate-900">
                  {investors.find((inv) => inv.investor_id === selectedInvestorId)?.investor_name}
                </span>
              </>
            )}
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{issueLabel}</h1>
              {taxonomy && (
                <p className="mt-0.5 text-sm text-slate-500">カテゴリ: {taxonomy.category}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* 投資家タブ（詳細モード時のみ表示） */}
        {selectedInvestorId && investorsWithRule.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              投資家フィルター
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/issues/${issueType}`}
                className="rounded-full border px-4 py-1.5 text-sm font-medium transition bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-700"
              >
                ← 投資家一覧に戻る
              </Link>
              {investorsWithRule.map((inv) => (
                <Link
                  key={inv.investor_id}
                  href={`/issues/${issueType}?investor=${inv.investor_id}`}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    inv.investor_id === selectedInvestorId
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-700"
                  }`}
                >
                  {inv.investor_name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 概要モード or 詳細モード */}
        {selectedInvestorId ? (
          <InvestorCompanyList
            issueType={validIssueType}
            selectedInvestorId={selectedInvestorId}
          />
        ) : (
          <InvestorOverview
            issueType={validIssueType}
            investorsWithRule={investorsWithRule}
          />
        )}

        {/* 注意事項 */}
        <section className="rounded-xl border bg-gray-50 px-5 py-4 text-xs text-gray-500 leading-6">
          <p className="font-semibold text-gray-700 mb-1">注意事項</p>
          <p>
            本ページはFACT・GUIDELINE・INFERENCEを分離した分析支援です。
            実際の議決権行使結果を保証しません。各社の詳細ページで根拠・過去行使事例を確認してください。
          </p>
          <p className="mt-1 text-gray-400">
            ※ 全判定はJSONデータ＋TypeScriptルールエンジンで処理しており、生成AIは使用していません。
          </p>
        </section>

        {/* 関連する基準 */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            関連する基準を確認する
          </p>
          <div className="flex flex-wrap gap-2">
            {issueTaxonomy
              .filter((t) => t.issue_type !== validIssueType)
              .slice(0, 10)
              .map((t) => (
                <Link
                  key={t.issue_type}
                  href={`/issues/${t.issue_type}`}
                  className="rounded-full border bg-white px-3 py-1 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-700 transition"
                >
                  {t.issue}
                </Link>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}
