"use client";

import Link from "next/link";
import { useState } from "react";
import type { GuidelineRule, IssueType } from "@/lib/types";

export interface AggregatedIssueRow {
  issueType: IssueType;
  issueLabel: string;
  category: string;
  investorCount: number;
  thresholdSummary: string;
  againstCount: number;
  rules: GuidelineRule[];
}

const categoryColors: Record<string, string> = {
  "取締役会構成": "bg-blue-50 text-blue-700",
  "個別取締役": "bg-violet-50 text-violet-700",
  "業績・資本効率": "bg-red-50 text-red-700",
  "業績・株価": "bg-orange-50 text-orange-700",
  "市場評価": "bg-amber-50 text-amber-700",
  "資本政策": "bg-teal-50 text-teal-700",
  "報酬": "bg-pink-50 text-pink-700",
  "買収防衛策": "bg-slate-100 text-slate-700",
  "株主提案": "bg-green-50 text-green-700",
};

export function AggregatedRulesTable({ rows }: { rows: AggregatedIssueRow[] }) {
  const [selected, setSelected] = useState<AggregatedIssueRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">論点</th>
              <th className="px-4 py-3 text-left font-semibold">カテゴリ</th>
              <th className="px-4 py-3 text-left font-semibold">閾値</th>
              <th className="px-4 py-3 text-center font-semibold">対象投資家</th>
              <th className="px-4 py-3 text-center font-semibold">反対実績</th>
              <th className="px-4 py-3 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr
                key={row.issueType}
                className="cursor-pointer transition hover:bg-slate-50"
                onClick={() => setSelected(row)}
              >
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.issueLabel}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryColors[row.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {row.category}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {row.thresholdSummary}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.investorCount > 0 ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {row.investorCount}社
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.againstCount > 0 ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      {row.againstCount.toLocaleString()}件
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/issues/${row.issueType}`}
                    className="rounded border px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    詳細 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-5 py-4">
              <div className="flex items-start gap-3">
                <div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryColors[selected.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {selected.category}
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">{selected.issueLabel}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    閾値: {selected.thresholdSummary} / 登録投資家: {selected.investorCount}社 / 反対実績: {selected.againstCount.toLocaleString()}件
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-auto rounded border px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                >
                  閉じる
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              {selected.rules.length === 0 ? (
                <p className="rounded bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  この論点はまだルールが登録されていません。
                </p>
              ) : (
                selected.rules.map((rule) => (
                  <div key={rule.rule_id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {rule.rule_id}
                      </span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {rule.investor_id}
                      </span>
                      {rule.threshold_value != null && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          閾値: {rule.threshold_value}{rule.threshold_unit}
                        </span>
                      )}
                      <span className={`ml-auto rounded px-2 py-0.5 text-xs ${rule.confidence === "High" ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-500"}`}>
                        {rule.confidence}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-slate-900">{rule.condition_text}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{rule.summary_text}</p>
                    {rule.official_target_text && (
                      <p className="mt-2 text-xs text-slate-500">反対対象: {rule.official_target_text}</p>
                    )}
                    {rule.source_url && (
                      <a
                        className="mt-2 block text-xs text-blue-700 hover:underline"
                        href={rule.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {rule.source_title || "出典を開く"}
                      </a>
                    )}
                  </div>
                ))
              )}

              <div className="flex justify-end pt-2">
                <Link
                  href={`/issues/${selected.issueType}`}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
                >
                  企業×投資家で詳細分析 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
