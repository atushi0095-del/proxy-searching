// 株主総会の議案別・候補者別の賛成率推移（EDINET臨時報告書ベース）。
// サーバーコンポーネント: data/generated/agm_vote_results/{code}.json を直接読む。
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

interface ProposalRecord {
  proposal_no: number;
  proposal_title: string;
  proposal_category: string;
  candidate_name: string | null;
  votes_for: number | null;
  votes_against: number | null;
  votes_abstain: number | null;
  approval_pct: number | null;
  approval_pct_source: "reported" | "computed";
  result: string | null;
}

interface Meeting {
  meeting_date: string;
  meeting_year: number | null;
  doc_id: string;
  source: string;
  proposals: ProposalRecord[];
}

interface Shard {
  company_code: string;
  company_name: string;
  meetings: Meeting[];
}

const DATA_DIR = path.join(process.cwd(), "data");

function loadShard(companyCode: string): Shard | null {
  const shardPath = path.join(DATA_DIR, "generated", "agm_vote_results", `${companyCode}.json`);
  if (!existsSync(shardPath)) return null;
  try {
    return JSON.parse(readFileSync(shardPath, "utf8")) as Shard;
  } catch {
    return null;
  }
}

function pctClass(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct < 70) return "font-bold text-red-700";
  if (pct < 80) return "font-bold text-orange-600";
  if (pct < 90) return "font-semibold text-amber-600";
  return "text-slate-700";
}

function deltaBadge(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  const delta = Math.round((current - previous) * 100) / 100;
  if (Math.abs(delta) < 0.5) return null;
  const isDown = delta < 0;
  return (
    <span className={`ml-1 text-[10px] font-semibold ${isDown ? "text-red-600" : "text-green-600"}`}>
      {isDown ? "▼" : "▲"}{Math.abs(delta).toFixed(1)}
    </span>
  );
}

export function AgmApprovalTrends({ companyCode }: { companyCode: string }) {
  const shard = loadShard(companyCode);
  if (!shard || shard.meetings.length === 0) return null;

  const meetings = [...shard.meetings].sort((a, b) => String(a.meeting_date).localeCompare(String(b.meeting_date)));
  const years = meetings.map((meeting) => meeting.meeting_year ?? 0);

  // 候補者ごとの年次賛成率（取締役・監査役選任議案の候補者行）
  const candidateRows = new Map<string, (number | null)[]>();
  // 議案カテゴリごとの年次賛成率（候補者なし議案）
  const categoryRows = new Map<string, (number | null)[]>();

  meetings.forEach((meeting, yearIdx) => {
    for (const proposal of meeting.proposals) {
      if (proposal.candidate_name) {
        if (!candidateRows.has(proposal.candidate_name)) {
          candidateRows.set(proposal.candidate_name, Array(meetings.length).fill(null));
        }
        candidateRows.get(proposal.candidate_name)![yearIdx] = proposal.approval_pct;
      } else {
        const key = proposal.proposal_category;
        if (!categoryRows.has(key)) {
          categoryRows.set(key, Array(meetings.length).fill(null));
        }
        // 同一カテゴリ複数議案の場合は最小値（最も厳しい評価）を採用
        const current = categoryRows.get(key)![yearIdx];
        if (proposal.approval_pct !== null && (current === null || proposal.approval_pct < current)) {
          categoryRows.get(key)![yearIdx] = proposal.approval_pct;
        }
      }
    }
  });

  // 直近年の賛成率が低い順に並べる（機関投資家の不満が見えやすい順）
  const sortedCandidates = [...candidateRows.entries()].sort((a, b) => {
    const lastA = [...a[1]].reverse().find((v) => v !== null) ?? 101;
    const lastB = [...b[1]].reverse().find((v) => v !== null) ?? 101;
    return lastA - lastB;
  });
  const sortedCategories = [...categoryRows.entries()].sort((a, b) => {
    const lastA = [...a[1]].reverse().find((v) => v !== null) ?? 101;
    const lastB = [...b[1]].reverse().find((v) => v !== null) ?? 101;
    return lastA - lastB;
  });

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-800">📊 総会賛成率の推移（EDINET臨時報告書）</h2>
        <span className="text-xs text-slate-400">
          {meetings.map((meeting) => (
            <a key={meeting.doc_id} className="ml-2 text-blue-600 hover:underline" href={meeting.source} target="_blank" rel="noreferrer">
              {meeting.meeting_year}年開示
            </a>
          ))}
        </span>
      </div>
      <p className="mb-3 text-xs leading-5 text-slate-500">
        賛成率の低下は機関投資家の反対増を示します。70%未満は赤、80%未満は橙、90%未満は黄で表示。
        ▲▼は前回総会比の変化です。
      </p>

      {sortedCandidates.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">取締役候補者</th>
                {years.map((year) => (
                  <th key={year} className="px-3 py-2 text-right font-semibold">{year}年</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedCandidates.map(([name, pcts]) => (
                <tr key={name}>
                  <td className="px-3 py-1.5 font-semibold text-slate-900">{name}</td>
                  {pcts.map((pct, idx) => (
                    <td key={idx} className="px-3 py-1.5 text-right whitespace-nowrap">
                      <span className={pctClass(pct)}>{pct !== null ? `${pct.toFixed(2)}%` : "-"}</span>
                      {deltaBadge(pct, idx > 0 ? pcts[idx - 1] : null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sortedCategories.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">議案カテゴリ</th>
                {years.map((year) => (
                  <th key={year} className="px-3 py-2 text-right font-semibold">{year}年</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedCategories.map(([category, pcts]) => (
                <tr key={category}>
                  <td className="px-3 py-1.5 font-semibold text-slate-900">{category}</td>
                  {pcts.map((pct, idx) => (
                    <td key={idx} className="px-3 py-1.5 text-right whitespace-nowrap">
                      <span className={pctClass(pct)}>{pct !== null ? `${pct.toFixed(2)}%` : "-"}</span>
                      {deltaBadge(pct, idx > 0 ? pcts[idx - 1] : null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
