"use client";

import { useState } from "react";
import type { GuidelineRule } from "@/lib/types";
import { issueLabels } from "@/lib/inference";

export function GuidelineRuleModalList({ rules }: { rules: GuidelineRule[] }) {
  const [selected, setSelected] = useState<GuidelineRule | null>(null);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {rules.map((rule) => (
          <button
            key={rule.rule_id}
            type="button"
            onClick={() => setSelected(rule)}
            className="rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
                {rule.rule_id}
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {issueLabels[rule.issue_type]}
              </span>
              <span className="text-xs text-slate-500">{rule.issue_category}</span>
            </div>
            <p className="mt-3 font-semibold text-slate-950">{rule.condition_text}</p>
            <p className="mt-2 text-sm text-slate-600">{rule.summary_text}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-50 px-2 py-1">閾値: {rule.threshold_value ?? "定性"}{rule.threshold_unit}</span>
              <span className="rounded bg-slate-50 px-2 py-1">対象: {rule.applies_to}</span>
              <span className="rounded bg-slate-50 px-2 py-1">信頼度: {rule.confidence}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-xs font-mono text-slate-500">{selected.rule_id}</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">{issueLabels[selected.issue_type]}</h3>
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
              <section>
                <h4 className="text-sm font-bold text-slate-500">基準内容（簡潔）</h4>
                <p className="mt-1 text-sm leading-6 text-slate-800">{selected.summary_text}</p>
              </section>
              <section>
                <h4 className="text-sm font-bold text-slate-500">原文の記載メモ</h4>
                <p className="mt-1 text-sm leading-6 text-slate-800">{selected.original_text}</p>
              </section>
              <section className="grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">公式反対対象</p>
                  <p className="mt-1">{selected.official_target_text}</p>
                </div>
                <div className="rounded bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">判定方法</p>
                  <p className="mt-1">{selected.calculation_method}</p>
                </div>
              </section>
              <section>
                <h4 className="text-sm font-bold text-slate-500">日本語ガイドラインリンク</h4>
                <a className="mt-1 block break-all text-sm text-blue-700 hover:underline" href={selected.source_url} target="_blank" rel="noreferrer">
                  {selected.source_title}
                </a>
                <p className="mt-1 text-xs text-slate-500">{selected.source_page}</p>
              </section>
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
