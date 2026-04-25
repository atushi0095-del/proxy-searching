import sourceRegistry from "@/data/generated/source_registry.json";
import downloadManifest from "@/data/generated/download_manifest.json";
import oppositionFocus from "@/data/generated/opposition_focus_companies.json";
import mufgSummary from "@/data/generated/mufg_vote_summary.json";
import nomuraSummary from "@/data/generated/nomura_am_vote_summary.json";
import resonaSummary from "@/data/generated/resona_am_vote_summary.json";
import daiwaSummary from "@/data/generated/daiwa_am_vote_summary.json";
import { companies, companyGovernanceMetrics, directors, financialMetrics, guidelineRules, investors } from "@/lib/data";

function percent(done: number, total: number) {
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-slate-900" style={{ width: `${value}%` }} />
    </div>
  );
}

function countAgainst(summary: { by_vote?: Record<string, number> }) {
  return Object.entries(summary.by_vote ?? {}).reduce(
    (total, [vote, count]) => (vote.includes("反対") ? total + count : total),
    0
  );
}

export function ProgressDashboard() {
  const parsedVoteRecords =
    mufgSummary.total_records + nomuraSummary.total_records + resonaSummary.total_records + daiwaSummary.total_records;
  const parsedAgainst =
    countAgainst(mufgSummary) + countAgainst(nomuraSummary) + countAgainst(resonaSummary) + countAgainst(daiwaSummary);

  const companiesWithFinancials = new Set(financialMetrics.map((metric) => metric.company_code)).size;
  const companiesWithGovernance = new Set(companyGovernanceMetrics.map((metric) => metric.company_code)).size;
  const companiesWithDirectors = new Set(directors.map((director) => director.company_code)).size;
  const targetInvestorCount = 12;
  const targetCompanySeed = 50;
  const targetRuleCount = 160;
  const targetParsedInvestors = 12;
  const parsedInvestorCount = 4;

  const stages = [
    {
      label: "投資家マスター",
      done: investors.length,
      total: targetInvestorCount,
      note: "主要国内外投資家の箱は作成済み",
    },
    {
      label: "ルールDB",
      done: guidelineRules.length,
      total: targetRuleCount,
      note: "主要基準は入ったが、公式文言の詳細化が次",
    },
    {
      label: "企業FACT",
      done: companiesWithFinancials,
      total: targetCompanySeed,
      note: `${companies.length}社中、財務 ${companiesWithFinancials}社 / ガバナンス ${companiesWithGovernance}社 / 役員 ${companiesWithDirectors}社`,
    },
    {
      label: "行使結果解析",
      done: parsedInvestorCount,
      total: targetParsedInvestors,
      note: "三菱UFJ信託、野村、りそな、大和を解析済み",
    },
    {
      label: "反対企業優先リスト",
      done: oppositionFocus.total_companies,
      total: 300,
      note: "反対された企業から次の収集対象を抽出",
    },
  ];

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">現在地</h2>
          <p className="mt-1 text-sm text-slate-600">
            MVPは「画面で分析できる骨格」から「実データを継続蓄積する段階」に入りました。
          </p>
        </div>
        <div className="rounded border bg-slate-50 px-3 py-2 text-xs text-slate-600">
          GitHub Actions: 週次収集設定済み
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">発見ソース</p>
          <p className="mt-1 text-2xl font-bold">{sourceRegistry.length}</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">取得済み資料</p>
          <p className="mt-1 text-2xl font-bold">{downloadManifest.length}</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">解析済み行使結果</p>
          <p className="mt-1 text-2xl font-bold">{parsedVoteRecords.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-3">
          <p className="text-xs text-red-700">反対行使</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{parsedAgainst.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {stages.map((stage) => {
          const value = percent(stage.done, stage.total);
          return (
            <div key={stage.label} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{stage.label}</p>
                  <p className="text-xs text-slate-500">{stage.note}</p>
                </div>
                <p className="text-sm font-bold">{value}%</p>
              </div>
              <Bar value={value} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
