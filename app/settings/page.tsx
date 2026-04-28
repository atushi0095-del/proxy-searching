import collectionPolicy from "@/data/collection_policy.json";
import oppositionFocus from "@/data/generated/opposition_focus_companies.json";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { investors } from "@/lib/data";

type OppositionFocusCompany = {
  company_code: string;
  company_name?: string;
  against_count: number;
  issues: Record<string, number>;
};

const focusCompanies = oppositionFocus.companies as OppositionFocusCompany[];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">収集・分析設定</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          GitHub Actionsで週次収集し、公式公開資料のみを低頻度で確認します。反対企業リストは行使結果Excelから生成し、今後の企業データ収集の優先順位に使います。
        </p>
      </section>

      <ProgressDashboard />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">対象投資家</p>
          <p className="mt-2 text-2xl font-bold">{investors.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">週次実行</p>
          <p className="mt-2 text-lg font-bold">月曜 8:00 JST</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">収集方式</p>
          <p className="mt-2 text-lg font-bold">公式公開資料のみ</p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">収集ポリシー</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {collectionPolicy.principles.map((principle) => (
            <div key={principle} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
              {principle}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          delay: {collectionPolicy.default_delay_ms}ms / max download: {collectionPolicy.max_download_bytes.toLocaleString()} bytes
        </p>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">次に優先して集めるデータ</h2>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          <p>1. 行使結果で反対された企業を抽出し、企業コード・投資家・論点・理由を集計。</p>
          <p>2. 抽出企業の有価証券報告書、招集通知、CG報告書、IRページを公式リンクから追加。</p>
          <p>3. ROE、PBR、TSR、取締役会構成、候補者属性を年度更新し、対象年以下の直近3期で判定。</p>
          <p>4. 役職履歴を追加し、「過去3年以内の社長」「過去3年以内の代表権付き会長」を構造条件として判定。</p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">反対された企業 優先リスト</h2>
          <span className="text-xs text-slate-500">{oppositionFocus.total_companies}社</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="pb-2 pr-4 font-semibold">企業</th>
                <th className="pb-2 pr-4 font-semibold">反対件数</th>
                <th className="pb-2 font-semibold">主な論点</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {focusCompanies.slice(0, 20).map((company) => (
                <tr key={`${company.company_code}-${company.company_name}`}>
                  <td className="py-2 pr-4">
                    <p className="font-semibold">{company.company_name || company.company_code}</p>
                    <p className="text-xs text-slate-500">{company.company_code}</p>
                  </td>
                  <td className="py-2 pr-4 font-semibold text-red-700">{company.against_count}</td>
                  <td className="py-2 text-xs text-slate-600">
                    {Object.entries(company.issues)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([issue, count]) => `${issue}: ${count}`)
                      .join(" / ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
