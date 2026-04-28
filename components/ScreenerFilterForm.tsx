"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export interface ScreenerFilters {
  indepMin: number | null;
  indepMax: number | null;
  femaleMin: number | null;
  roeMax: number | null;
  roePeriods: number | null;
  boardType: string[];
  investor: string;
}

interface Props {
  investors: { investor_id: string; investor_name: string }[];
  currentFilters: ScreenerFilters;
}

const BOARD_TYPES = [
  { value: "audit", label: "監査役設置会社" },
  { value: "audit_committee", label: "監査等委員会設置会社" },
  { value: "nomination_committee", label: "指名委員会等設置会社" },
];

export function ScreenerFilterForm({ investors, currentFilters }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<ScreenerFilters>(currentFilters);

  const apply = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.indepMin != null) p.set("indep_min", String(filters.indepMin));
    if (filters.indepMax != null) p.set("indep_max", String(filters.indepMax));
    if (filters.femaleMin != null) p.set("female_min", String(filters.femaleMin));
    if (filters.roeMax != null) p.set("roe_max", String(filters.roeMax));
    if (filters.roePeriods != null) p.set("roe_periods", String(filters.roePeriods));
    if (filters.boardType.length > 0) p.set("board_type", filters.boardType.join(","));
    if (filters.investor) p.set("investor", filters.investor);
    router.push(`/screen?${p.toString()}`);
  }, [filters, router]);

  const reset = useCallback(() => {
    setFilters({
      indepMin: null, indepMax: null, femaleMin: null,
      roeMax: null, roePeriods: null, boardType: [], investor: "",
    });
    router.push("/screen");
  }, [router]);

  const toggleBoardType = (val: string) => {
    setFilters(f => ({
      ...f,
      boardType: f.boardType.includes(val)
        ? f.boardType.filter(v => v !== val)
        : [...f.boardType, val],
    }));
  };

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-bold text-slate-800">スクリーニング条件</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 社外取締役比率 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            社外取締役比率（独立役員）
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0} max={100} step={5}
              placeholder="下限 %"
              value={filters.indepMin ?? ""}
              onChange={e => setFilters(f => ({ ...f, indepMin: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-slate-400">〜</span>
            <input
              type="number"
              min={0} max={100} step={5}
              placeholder="上限 %"
              value={filters.indepMax ?? ""}
              onChange={e => setFilters(f => ({ ...f, indepMax: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { label: "33%未満", min: null, max: 33 },
              { label: "33〜50%", min: 33, max: 50 },
              { label: "50%以上", min: 50, max: null },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => setFilters(f => ({ ...f, indepMin: preset.min, indepMax: preset.max }))}
                className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 女性取締役比率 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            女性取締役比率
          </label>
          <input
            type="number"
            min={0} max={100} step={5}
            placeholder="下限 % (以上を検索)"
            value={filters.femaleMin ?? ""}
            onChange={e => setFilters(f => ({ ...f, femaleMin: e.target.value ? Number(e.target.value) : null }))}
            className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { label: "0%（女性なし）", val: null, exact0: true },
              { label: "10%以上", val: 10 },
              { label: "20%以上", val: 20 },
              { label: "30%以上", val: 30 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => setFilters(f => ({ ...f, femaleMin: preset.val ?? null }))}
                className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:border-rose-300 hover:bg-rose-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ROE */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            ROE（直近期）
          </label>
          <input
            type="number"
            min={-50} max={50} step={1}
            placeholder="上限 % (以下を検索)"
            value={filters.roeMax ?? ""}
            onChange={e => setFilters(f => ({ ...f, roeMax: e.target.value ? Number(e.target.value) : null }))}
            className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { label: "5%未満", val: 5 },
              { label: "8%未満", val: 8 },
              { label: "0%未満（赤字）", val: 0 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => setFilters(f => ({ ...f, roeMax: preset.val }))}
                className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:border-red-300 hover:bg-red-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-xs text-slate-500">連続期数（N期連続でROE上限以下）</label>
            <select
              value={filters.roePeriods ?? ""}
              onChange={e => setFilters(f => ({ ...f, roePeriods: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">指定なし（直近1期）</option>
              <option value="2">2期連続</option>
              <option value="3">3期連続</option>
            </select>
          </div>
        </div>

        {/* 機関設計 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            機関設計（複数選択可）
          </label>
          <div className="space-y-1.5">
            {BOARD_TYPES.map(bt => (
              <label key={bt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.boardType.includes(bt.value)}
                  onChange={() => toggleBoardType(bt.value)}
                  className="h-3.5 w-3.5 accent-blue-600"
                />
                <span className="text-sm text-slate-700">{bt.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">特定の投資家</label>
            <select
              value={filters.investor}
              onChange={e => setFilters(f => ({ ...f, investor: e.target.value }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">全投資家</option>
              {investors.map(inv => (
                <option key={inv.investor_id} value={inv.investor_id}>
                  {inv.investor_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={apply}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          検索する
        </button>
        <button
          onClick={reset}
          className="rounded-lg border px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          リセット
        </button>
      </div>
    </div>
  );
}
