"use client";

import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────
// Types (serializable — passed from Server Component)
// ─────────────────────────────────────────────────────────

export interface InvestorDetailRow {
  investor_id: string;
  investor_name: string;
  /** "全賛成" | "X件反対（ROE基準 他）" | "行使実績なし" */
  actual_summary: string;
  actual_against: number;
  actual_for: number;
  /** Top reasons (max 2) from actual vote data */
  actual_reasons: string[];
  /** "High" | "Medium-High" | "Medium" | "Low" | "Not likely" */
  estimated_level: string;
  /** e.g. "Medium-High（ROE基準）" | "反対推定なし" */
  estimated_summary: string;
  estimated_directors: string[];
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
// Component
// ─────────────────────────────────────────────────────────

const levelColorClass: Record<string, string> = {
  High: "text-red-600 font-semibold",
  "Medium-High": "text-orange-600 font-semibold",
  Medium: "text-yellow-600 font-semibold",
  Low: "text-slate-500",
  "Not likely": "text-green-600",
};

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
                    {/* 展開矢印 */}
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
                      {r.roeNote && (
                        <span className="ml-1 text-xs text-slate-400">{r.roeNote}</span>
                      )}
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
                    <tr key={`${r.company_code}-expand`} className="border-b bg-blue-50/20">
                      <td colSpan={9} className="px-6 py-3">
                        <div className="space-y-1.5">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            投資家ごとの賛否情報
                          </p>
                          {r.investorDetails.map(d => (
                            <div
                              key={d.investor_id}
                              className="flex flex-wrap items-start gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-white px-3 py-2"
                            >
                              {/* 投資家名 */}
                              <span className="w-36 shrink-0 text-sm font-semibold text-slate-800">
                                {d.investor_name}
                              </span>

                              {/* 実績 */}
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                  実績
                                </span>
                                <span
                                  className={
                                    d.actual_against > 0
                                      ? "font-medium text-red-600"
                                      : d.actual_for > 0
                                      ? "font-medium text-green-600"
                                      : "text-slate-400"
                                  }
                                >
                                  {d.actual_summary}
                                </span>
                                {d.actual_reasons[0] && (
                                  <span className="max-w-xs truncate text-xs text-slate-500">
                                    — {d.actual_reasons[0]}
                                  </span>
                                )}
                              </div>

                              {/* 推定 */}
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                  推定
                                </span>
                                <span className={levelColorClass[d.estimated_level] ?? "text-slate-500"}>
                                  {d.estimated_summary}
                                </span>
                                {d.estimated_directors.length > 0 && (
                                  <span className="text-xs text-slate-400">
                                    ({d.estimated_directors.slice(0, 2).join("・")})
                                  </span>
                                )}
                              </div>

                              {/* 詳細リンク */}
                              <Link
                                href={d.company_detail_href}
                                className="ml-auto text-xs text-blue-500 hover:text-blue-700 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                詳細 →
                              </Link>
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
