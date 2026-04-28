import sourceRegistry from "@/data/generated/source_registry.json";
import downloadManifest from "@/data/generated/download_manifest.json";
import oppositionFocus from "@/data/generated/opposition_focus_companies.json";
import mufgSummary from "@/data/generated/mufg_vote_summary.json";
import nomuraSummary from "@/data/generated/nomura_am_vote_summary.json";
import resonaSummary from "@/data/generated/resona_am_vote_summary.json";
import daiwaSummary from "@/data/generated/daiwa_am_vote_summary.json";
import amovaAmSummary from "@/data/generated/amova_am_vote_summary.json";
import fidelityJapanSummary from "@/data/generated/fidelity_japan_vote_summary.json";
import mufgAmSummary from "@/data/generated/mufg_am_vote_summary.json";
import nissayAmSummary from "@/data/generated/nissay_am_vote_summary.json";
import smtamSummary from "@/data/generated/sumitomo_mitsui_trust_am_vote_summary.json";
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
  const allSummaries = [
    mufgSummary, nomuraSummary, resonaSummary, daiwaSummary,
    amovaAmSummary, fidelityJapanSummary, mufgAmSummary, nissayAmSummary, smtamSummary,
  ];
  const parsedVoteRecords = allSummaries.reduce((sum, s) => sum + (s.total_records ?? 0), 0);
  const parsedAgainst = allSummaries.reduce((sum, s) => sum + countAgainst(s), 0);

  const companiesWithFinancials = new Set(financialMetrics.map((metric) => metric.company_code)).size;
  const companiesWithGovernance = new Set(companyGovernanceMetrics.map((metric) => metric.company_code)).size;
  const companiesWithDirectors = new Set(directors.map((director) => director.company_code)).size;
  const targetInvestorCount = 12;
  const targetCompanySeed = 50;
  const targetRuleCount = 160;
  const targetParsedInvestors = 12;
  const parsedInvestorCount = allSummaries.length;

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
      note: "三菱UFJ信託・野村・りそな・大和・アモーヴァ・フィディリティ・三菱UFJ-AM・ニッセイ・三井住友トラスト-AMを解析済み",
    },
    {
      label: "反対企業優先リスト",
      done: oppositionFocus.total_companies,
      total: 300,
      note: "反対された企業から次の収集対象を抽出",
    },
  ];

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      {/* 統計行（常時表示） */}
      <div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500">発見ソース</p>
          <p className="mt-0.5 text-xl font-bold">{sourceRegistry.length}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500">取得済み資料</p>
          <p className="mt-0.5 text-xl font-bold">{downloadManifest.length}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500">解析済み行使結果</p>
          <p className="mt-0.5 text-xl font-bold">{parsedVoteRecords.toLocaleString()}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-red-600">反対行使</p>
          <p className="mt-0.5 text-xl font-bold text-red-700">{parsedAgainst.toLocaleString()}</p>
        </div>
      </div>

      {/* 進捗バー（アコーディオン） */}
      <details className="border-t">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-xs text-slate-500 hover:bg-slate-50">
          <span>データ整備進捗を表示</span>
          <span className="rounded border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
            GitHub Actions: 週次収集設定済み
          </span>
        </summary>
        <div className="space-y-3 px-4 pb-4 pt-3">
          {stages.map((stage) => {
            const value = percent(stage.done, stage.total);
            return (
              <div key={stage.label}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{stage.label}</p>
                    <p className="text-xs text-slate-500">{stage.note}</p>
                  </div>
                  <p className="text-sm font-bold">{value}%</p>
                </div>
                <Bar value={value} />
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
