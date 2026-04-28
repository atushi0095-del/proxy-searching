"use client";

import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────
// Types (serializable — passed from Server Component)
// ─────────────────────────────────────────────────────────

export interface DirectorSummary {
  name: string;
  is_president: boolean;
  is_chair: boolean;
  is_outside_director: boolean;
  is_female: boolean;
  has_representative_authority: boolean;
  is_board_chair: boolean;
  is_nomination_committee_chair: boolean;
  tenure_years: number | null;
  /** OppositionLevel string */
  level: string;
  level_badge_class: string;
  issue_labels: string[];
}

export interface InvestorDetailRow {
  investor_id: string;
  investor_name: string;
  /** "全賛成" | "X件反対（論点名）" | "行使実績なし" */
  actual_summary: string;
  actual_against: number;
  actual_for: number;
  /** Top reasons (max 2) from actual vote data */
  actual_reasons: string[];
  /** "High" | "Medium-High" | "Medium" | "Low" | "Not likely" */
  estimated_level: string;
  /** e.g. "Medium-High（ROE基準）" | "反対推定なし" */
  estimated_summary: string;
  /** Candidates with level ≥ Low */
  opposition_directors: DirectorSummary[];
  company_detail_href: string;
}

export interface CompanyTableRow {
  company_code: string;
  company_name: string;
  market: string;
  sector: string;
  boardTypeLabel: string;
  boardTypeBadgeClass: string;
  marketBadgeClass: string;
  indepRatio: number | null;
  femaleRatio: number | null;
  indepRatioClass: string;
  femaleRatioClass: string;
  latestROE: number | null;
  roeClass: string;
  roeNote: string;
  hasAnyOpposition: boolean;
  investorBadges: {
    investor_id: string;
    shortName: string;
    badgeClass: string;
    title: string;
    href: string;
  }[];
  investorDetails: InvestorDetailRow[];
  detailHref: string;
}

// ─────────────────────────────────────────────────────────
// Badge helpers
// ─────────────────────────────────────────────────────────

const levelColorClass: Record<string, string> = {
  High: "text-red-600 font-semibold",
  "Medium-High": "text-orange-600 font-semibold",
  Medium: "text-yellow-600 font-semibold",
  Low: "text-slate-500",
  "Not likely": "text-green-600",
};

function DirectorAttrBadges({ d }: { d: DirectorSummary }) {
  const badges: { label: string; cls: string }[] = [];
  if (d.is_president) badges.push({ label: "社長", cls: "bg-rose-100 text-rose-700 border border-rose-200" });
  if (d.is_chair) badges.push({ label: "会長", cls: "bg-purple-100 text-purple-700 border border-purple-200" });
  if (d.has_representative_authority && !d.is_outside_director)
    badges.push({ label: "代表", cls: "bg-amber-100 text-amber-700 border border-amber-200" });
  if (d.is_board_chair) badges.push({ label: "取締役会議長", cls: "bg-indigo-100 text-indigo-700 border border-indigo-200" });
  if (d.is_nomination_committee_chair)
    badges.push({ label: "指名委員長", cls: "bg-violet-100 text-violet-700 border border-violet-200" });
  if (d.is_outside_director) badges.push({ label: "社外", cls: "bg-sky-100 text-sky-700 border border-sky-200" });
  if (d.is_female) badges.push({ label: "女性", cls: "bg-pink-100 text-pink-700 border border-pink-200" });
  else if (!d.is_outside_director) badges.push({ label: "男性", cls: "bg-slate-100 text-slate-500 border border-slate-200" });

  return (
    <>
      {badges.map(b => (
        <span key={b.label} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>
          {b.label}
        </span>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

interface Props {
  rows: CompanyTableRow[];
}

export function ScreenerResultTable({ rows }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
        条件に合う企業が見つかりませんでした。条件を変更してください。
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3">企業</th>
              <th className="px-4 py-3">市場</th>
              <th className="px-4 py-3 text-center">機関設計</th>
              <th className="px-4 py-3 text-right">社外比率</th>
              <th className="px-4 py-3 text-right">女性比率</th>
              <th className="px-4 py-3 text-right">ROE</th>
              <th className="px-4 py-3 text-center">反対推定（投資家別）</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isOpen = expanded.has(r.company_code);
              return (
                <>
                  {/* ── メイン行 ── */}
                  <tr
                    key={r.company_code}
                    className={`border-b cursor-pointer transition-colors hover:bg-slate-50/70 ${isOpen ? "bg-blue-50/30" : ""}`}
                    onClick={() => toggle(r.company_code)}
                  >
                    <td className="px-3 py-3 text-slate-400">
                      <span
                        className="inline-block text-xs transition-transform duration-200"
                        style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                      >
                        ▶
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.company_name}</div>
                      <div className="text-xs text-slate-400">{r.company_code} / {r.sector}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${r.marketBadgeClass}`}>
                        {r.market?.replace("東証", "") ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.boardTypeBadgeClass}`}>
                        {r.boardTypeLabel}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm ${r.indepRatioClass}`}>
                      {r.indepRatio !== null ? `${r.indepRatio.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm ${r.femaleRatioClass}`}>
                      {r.femaleRatio !== null ? `${r.femaleRatio.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm ${r.roeClass}`}>
                      {r.latestROE !== null ? `${r.latestROE.toFixed(1)}%` : "—"}
                      {r.roeNote && <span className="ml-1 text-xs text-slate-400">{r.roeNote}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        {r.investorBadges.map(b => (
                          <Link
                            key={b.investor_id}
                            href={b.href}
                            title={b.title}
                            onClick={e => e.stopPropagation()}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight hover:opacity-80 ${b.badgeClass}`}
                          >
                            {b.shortName}
                          </Link>
                        ))}
                        {!r.hasAnyOpposition && (
                          <span className="text-xs text-slate-400">反対推定なし</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <Link
                        href={r.detailHref}
                        className="rounded border px-2 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        詳細 →
                      </Link>
                    </td>
                  </tr>

                  {/* ── 展開行（投資家ごとの賛否情報） ── */}
                  {isOpen && (
                    <tr key={`${r.company_code}-expand`} className="border-b bg-slate-50/60">
                      <td colSpan={9} className="px-5 py-3">
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          投資家ごとの賛否情報
                        </p>

                        <div className="space-y-2">
                          {r.investorDetails.map(d => (
                            <div
                              key={d.investor_id}
                              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                            >
                              {/* ── ヘッダー行：投資家名 + 実績 + 推定サマリー ── */}
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                <span className="w-36 shrink-0 text-sm font-bold text-slate-800">
                                  {d.investor_name}
                                </span>

                                {/* 実績 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    実績
                                  </span>
                                  <span
                                    className={
                                      d.actual_against > 0
                                        ? "text-sm font-semibold text-red-600"
                                        : d.actual_for > 0
                                        ? "text-sm font-semibold text-green-600"
                                        : "text-sm text-slate-400"
                                    }
                                  >
                                    {d.actual_summary}
                                  </span>
                                  {d.actual_reasons[0] && (
                                    <span className="hidden max-w-xs truncate text-xs text-slate-500 sm:block">
                                      — {d.actual_reasons[0]}
                                    </span>
                                  )}
                                </div>

                                {/* 推定サマリー */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    推定
                                  </span>
                                  <span className={`text-sm ${levelColorClass[d.estimated_level] ?? "text-slate-500"}`}>
                                    {d.estimated_summary}
                                  </span>
                                </div>

                                <Link
                                  href={d.company_detail_href}
                                  onClick={e => e.stopPropagation()}
                                  className="ml-auto text-xs text-blue-500 hover:text-blue-700 hover:underline"
                                >
                                  詳細 →
                                </Link>
                              </div>

                              {/* ── 反対候補者（属性バッジ + 任期） ── */}
                              {d.opposition_directors.length > 0 && (
                                <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
                                  {d.opposition_directors.map((dir, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-2">
                                      {/* 属性バッジ */}
                                      <DirectorAttrBadges d={dir} />

                                      {/* 氏名 */}
                                      <span className="text-sm font-medium text-slate-800">
                                        {dir.name}
                                      </span>

                                      {/* 任期 */}
                                      {dir.tenure_years != null && (
                                        <span className="text-xs text-slate-500">
                                          任期 {dir.tenure_years}年
                                        </span>
                                      )}

                                      {/* 反対推定レベル */}
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${dir.level_badge_class}`}>
                                        {dir.level}
                                      </span>

                                      {/* 論点ラベル */}
                                      {dir.issue_labels.length > 0 && (
                                        <span className="text-xs text-slate-500">
                                          {dir.issue_labels.slice(0, 2).join(" / ")}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
