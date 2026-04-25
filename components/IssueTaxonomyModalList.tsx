"use client";

import { useMemo, useState } from "react";
import type { GuidelineRule, IssueType } from "@/lib/types";

type TaxonomyItem = {
  category: string;
  issue: string;
  issue_type: IssueType;
};

export function IssueTaxonomyModalList({
  items,
  rules,
}: {
  items: TaxonomyItem[];
  rules: GuidelineRule[];
}) {
  const [selected, setSelected] = useState<TaxonomyItem | null>(null);
  const rulesByIssue = useMemo(() => {
    const map = new Map<IssueType, GuidelineRule[]>();
    for (const rule of rules) {
      const existing = map.get(rule.issue_type) ?? [];
      existing.push(rule);
      map.set(rule.issue_type, existing);
    }
    return map;
  }, [rules]);

  const selectedRules = selected ? rulesByIssue.get(selected.issue_type) ?? [] : [];

  return (
    <>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const implemented = (rulesByIssue.get(item.issue_type) ?? []).length > 0;
          return (
            <button
              type="button"
              key={item.issue_type}
              onClick={() => setSelected(item)}
              className="flex items-center justify-between rounded border px-3 py-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
            >
              <span>
                <span className="text-slate-500">{item.category}</span> / {item.issue}
              </span>
              <span className={implemented ? "text-green-700" : "text-slate-400"}>
                {implemented ? "実装済み" : "分類のみ"}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-sm text-slate-500">{selected.category}</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">{selected.issue}</h3>
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

            <div className="space-y-5 px-5 py-4">
              <section>
                <h4 className="text-sm font-bold text-slate-500">分析結果として提示する基準</h4>
                {selectedRules.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {selectedRules.map((rule) => (
                      <div key={rule.rule_id} className="rounded border bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-white px-2 py-0.5 text-xs font-mono text-slate-600">{rule.rule_id}</span>
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{rule.investor_id === "blackrock" ? "BlackRock" : "三菱UFJ信託銀行"}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-800">{rule.summary_text}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">判定方法: {rule.calculation_method}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">主な反対対象候補: {rule.official_target_text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    現時点では分類のみです。今後、公式ガイドラインと行使結果から条件・反対対象・賛成条件を追加します。
                  </p>
                )}
              </section>

              <section>
                <h4 className="text-sm font-bold text-slate-500">議決権行使ガイドラインの原文メモ</h4>
                {selectedRules.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {selectedRules.map((rule) => (
                      <div key={`${rule.rule_id}-original`} className="rounded border p-3">
                        <p className="text-sm leading-6 text-slate-800">{rule.original_text}</p>
                        <a className="mt-2 block break-all text-sm text-blue-700 hover:underline" href={rule.source_url} target="_blank" rel="noreferrer">
                          {rule.source_title}
                        </a>
                        <p className="mt-1 text-xs text-slate-500">{rule.source_page}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">原文未登録。公式資料の収集・抽出対象です。</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
