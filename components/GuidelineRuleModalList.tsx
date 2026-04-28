"use client";

import { useState } from "react";
import type { GuidelineRule } from "@/lib/types";
import { issueLabels } from "@/lib/inference";

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

export function GuidelineRuleModalList({ rules }: { rules: GuidelineRule[] }) {
  const [selected, setSelected] = useState<GuidelineRule | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">基準</th>
              <th className="px-3 py-2 text-left font-semibold">カテゴリ</th>
              <th className="px-3 py-2 text-left font-semibold">条件</th>
              <th className="px-3 py-2 text-center font-semibold">閾値</th>
              <th className="px-3 py-2 text-center font-semibold">確信度</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.map((rule) => (
              <tr
                key={rule.rule_id}
                className="cursor-pointer transition hover:bg-slate-50"
                onClick={() => setSelected(rule)}
              >
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{issueLabels[rule.issue_type] ?? rule.issue_type}</p>
                  <p className="font-mono text-[10px] text-slate-400">{rule.rule_id}</p>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${categoryColors[rule.issue_category] ?? "bg-slate-100 text-slate-600"}`}>
                    {rule.issue_category}
                  </span>
                </td>
                <td className="max-w-xs px-3 py-2 text-slate-600">
                  <p className="line-clamp-2 leading-5">{rule.condition_text}</p>
                </td>
                <td className="px-3 py-2 text-center font-mono text-slate-700">
                  {rule.threshold_value != null ? `${rule.threshold_value}${rule.threshold_unit}` : <span className="text-slate-400">定性</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${rule.confidence === "High" ? "bg-green-50 text-green-700" : rule.confidence === "Medium-High" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {rule.confidence}
                  </span>
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
                  <p className="font-mono text-xs text-slate-400">{selected.rule_id}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {issueLabels[selected.issue_type] ?? selected.issue_type}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryColors[selected.issue_category] ?? "bg-slate-100 text-slate-600"}`}>
                      {selected.issue_category}
                    </span>
                    {selected.threshold_value != null && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        閾値: {selected.threshold_value}{selected.threshold_unit}
                      </span>
                    )}
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${selected.confidence === "High" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {selected.confidence}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-auto rounded border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  閉じる
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-slate-500">条件（簡潔）</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">{selected.summary_text}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500">条件（詳細）</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">{selected.condition_text}</p>
              </div>
              {selected.original_text && (
                <div>
                  <p className="text-xs font-bold text-slate-500">原文メモ</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{selected.original_text}</p>
                </div>
              )}
              <div className="grid gap-2 text-sm md:grid-cols-2">
                {selected.official_target_text && (
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">公式反対対象</p>
                    <p className="mt-1 text-xs leading-5">{selected.official_target_text}</p>
                  </div>
                )}
                {selected.calculation_method && (
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">判定方法</p>
                    <p className="mt-1 text-xs leading-5">{selected.calculation_method}</p>
                  </div>
                )}
                {selected.applies_to && (
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">適用対象</p>
                    <p className="mt-1 text-xs leading-5">{selected.applies_to}</p>
                  </div>
                )}
                {selected.lookback_years != null && (
                  <div className="rounded bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">参照期間</p>
                    <p className="mt-1 text-xs">{selected.lookback_years}期</p>
                  </div>
                )}
              </div>
              {selected.source_url && (
                <div>
                  <p className="text-xs font-bold text-slate-500">日本語ガイドライン</p>
                  <a
                    className="mt-1 block break-all text-sm text-blue-700 hover:underline"
                    href={selected.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.source_title || selected.source_url}
                  </a>
                  {selected.source_page && <p className="mt-0.5 text-xs text-slate-400">{selected.source_page}</p>}
                </div>
              )}
              {selected.notes && (
                <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{selected.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
