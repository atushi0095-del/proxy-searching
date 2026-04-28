"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ScreenerFilters {
  // 財務
  roeMax: number | null;
  roePeriods: number | null;
  // ガバナンス（比率）
  indepMin: number | null;
  indepMax: number | null;
  femaleMin: number | null;
  // 機関設計
  boardType: string[];
  // 役員構成
  execRole: "" | "chair" | "president" | "rep_chair" | "rep_president"; // 役職種別
  execHas:  "" | "true" | "false";                                       // あり/なし
  outsideTenureMin: number | null;       // 社外取締役の最長在任 N 年以上の候補者あり
  boardChairType: "" | "outside" | "inside"; // 取締役会議長が社外独立/社内
  hasFemaleOutside: "" | "true" | "false";   // 女性社外取締役
  // 投資家
  investor: string;
}

// ─────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────

interface Preset {
  label: string;
  hint: string;
  patch: Partial<ScreenerFilters>;
}

const PRESETS: Preset[] = [
  {
    label: "代表取締役会長あり",
    hint: "代表権付き会長が存在する企業（権限集中リスク）",
    patch: { execRole: "rep_chair", execHas: "true" },
  },
  {
    label: "代表会長+低ROE",
    hint: "代表取締役会長あり かつ ROE3期連続5%未満（責任取締役仮説）",
    patch: { execRole: "rep_chair", execHas: "true", roeMax: 5, roePeriods: 3 },
  },
  {
    label: "社外在任12年超",
    hint: "社外取締役の在任期間が12年以上の候補者がいる企業",
    patch: { outsideTenureMin: 12 },
  },
  {
    label: "社外在任8年超",
    hint: "社外取締役の在任期間が8年以上の候補者がいる企業",
    patch: { outsideTenureMin: 8 },
  },
  {
    label: "社内議長",
    hint: "取締役会議長が社内取締役（独立性低）",
    patch: { boardChairType: "inside" },
  },
  {
    label: "ROE3期5%未満",
    hint: "BlackRock等のROE反対基準に抵触する企業",
    patch: { roeMax: 5, roePeriods: 3 },
  },
  {
    label: "社外比率1/3未満",
    hint: "独立社外取締役比率が33%未満（多くの投資家が反対基準）",
    patch: { indepMax: 33 },
  },
  {
    label: "女性取締役なし",
    hint: "取締役会に女性がいない企業（多くの投資家が論点視）",
    patch: { femaleMin: null, hasFemaleOutside: "false" },
  },
];

const EMPTY: ScreenerFilters = {
  roeMax: null, roePeriods: null,
  indepMin: null, indepMax: null, femaleMin: null,
  boardType: [],
  execRole: "", execHas: "", outsideTenureMin: null, boardChairType: "", hasFemaleOutside: "",
  investor: "",
};

const BOARD_TYPES = [
  { value: "audit", label: "監査役設置会社" },
  { value: "audit_committee", label: "監査等委員会設置会社" },
  { value: "nomination_committee", label: "指名委員会等設置会社" },
];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function filtersToParams(f: ScreenerFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.indepMin != null) p.set("indep_min", String(f.indepMin));
  if (f.indepMax != null) p.set("indep_max", String(f.indepMax));
  if (f.femaleMin != null) p.set("female_min", String(f.femaleMin));
  if (f.roeMax != null) p.set("roe_max", String(f.roeMax));
  if (f.roePeriods != null) p.set("roe_periods", String(f.roePeriods));
  if (f.boardType.length > 0) p.set("board_type", f.boardType.join(","));
  if (f.execRole) p.set("exec_role", f.execRole);
  if (f.execHas)  p.set("exec_has",  f.execHas);
  if (f.outsideTenureMin != null) p.set("outside_tenure_min", String(f.outsideTenureMin));
  if (f.boardChairType) p.set("board_chair_type", f.boardChairType);
  if (f.hasFemaleOutside) p.set("has_female_outside", f.hasFemaleOutside);
  if (f.investor) p.set("investor", f.investor);
  return p;
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

interface Props {
  investors: { investor_id: string; investor_name: string }[];
  currentFilters: ScreenerFilters;
}

export function ScreenerFilterForm({ investors, currentFilters }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<ScreenerFilters>(currentFilters);
  const [showHint, setShowHint] = useState<string | null>(null);

  const apply = useCallback(() => {
    router.push(`/screen?${filtersToParams(filters).toString()}`);
  }, [filters, router]);

  const reset = useCallback(() => {
    setFilters(EMPTY);
    router.push("/screen");
  }, [router]);

  const applyPreset = (preset: Preset) => {
    const merged = { ...EMPTY, ...preset.patch };
    setFilters(merged);
    router.push(`/screen?${filtersToParams(merged).toString()}`);
  };

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
      {/* ── 仮説プリセット ── */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">仮説プリセット</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              onMouseEnter={() => setShowHint(preset.label)}
              onMouseLeave={() => setShowHint(null)}
              className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {preset.label}
            </button>
          ))}
        </div>
        {showHint && (
          <p className="mt-1.5 text-xs text-slate-500">
            {PRESETS.find(p => p.label === showHint)?.hint}
          </p>
        )}
      </div>

      <hr className="mb-4 border-slate-100" />
      <h2 className="mb-3 font-bold text-slate-800">絞り込み条件</h2>

      {/* ── 行1: 財務・比率・機関設計 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 社外取締役比率 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            社外取締役比率（独立役員）
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={100} step={5}
              placeholder="下限 %"
              value={filters.indepMin ?? ""}
              onChange={e => setFilters(f => ({ ...f, indepMin: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="shrink-0 text-slate-400">〜</span>
            <input
              type="number" min={0} max={100} step={5}
              placeholder="上限 %"
              value={filters.indepMax ?? ""}
              onChange={e => setFilters(f => ({ ...f, indepMax: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { label: "1/3未満", min: null, max: 33 },
              { label: "1/3〜半数", min: 33, max: 50 },
              { label: "過半数以上", min: 50, max: null },
            ].map(p => (
              <button key={p.label}
                onClick={() => setFilters(f => ({ ...f, indepMin: p.min, indepMax: p.max }))}
                className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* 女性比率 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            女性取締役比率
          </label>
          <input
            type="number" min={0} max={100} step={5}
            placeholder="下限 %（以上を検索）"
            value={filters.femaleMin ?? ""}
            onChange={e => setFilters(f => ({ ...f, femaleMin: e.target.value ? Number(e.target.value) : null }))}
            className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { label: "10%以上", val: 10 },
              { label: "20%以上", val: 20 },
              { label: "30%以上", val: 30 },
            ].map(p => (
              <button key={p.label}
                onClick={() => setFilters(f => ({ ...f, femaleMin: p.val }))}
                className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:border-rose-300 hover:bg-rose-50"
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* ROE */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            ROE（直近期）
          </label>
          <input
            type="number" min={-50} max={50} step={1}
            placeholder="上限 %（以下を検索）"
            value={filters.roeMax ?? ""}
            onChange={e => setFilters(f => ({ ...f, roeMax: e.target.value ? Number(e.target.value) : null }))}
            className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { label: "5%未満", val: 5 },
              { label: "8%未満", val: 8 },
              { label: "赤字", val: 0 },
            ].map(p => (
              <button key={p.label}
                onClick={() => setFilters(f => ({ ...f, roeMax: p.val }))}
                className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:border-red-300 hover:bg-red-50"
              >{p.label}</button>
            ))}
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-xs text-slate-500">連続期数</label>
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

        {/* 機関設計 + 投資家 */}
        <div className="space-y-3">
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
          </div>
          <div>
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

      {/* ── 行2: 役員構成フィルター ── */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-semibold text-slate-500">役員構成フィルター</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

          {/* 役職種別フィルター（2段） */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              役職（役員の在任）
            </label>
            <select
              value={filters.execRole}
              onChange={e => setFilters(f => ({ ...f, execRole: e.target.value as ScreenerFilters["execRole"] }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">役職種別を選択</option>
              <option value="chair">会長（代表権有無問わず）</option>
              <option value="rep_chair">代表取締役会長</option>
              <option value="president">社長（代表権有無問わず）</option>
              <option value="rep_president">代表取締役社長</option>
            </select>
            <select
              value={filters.execHas}
              onChange={e => setFilters(f => ({ ...f, execHas: e.target.value as ScreenerFilters["execHas"] }))}
              disabled={!filters.execRole}
              className="mt-1.5 w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">あり/なし 選択</option>
              <option value="true">あり</option>
              <option value="false">なし</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              {filters.execRole === "chair" && "is_chair が true の取締役"}
              {filters.execRole === "rep_chair" && "会長 かつ 代表取締役"}
              {filters.execRole === "president" && "is_president が true の取締役"}
              {filters.execRole === "rep_president" && "社長 かつ 代表取締役"}
              {!filters.execRole && "役職種別を先に選択してください"}
            </p>
          </div>

          {/* 社外取締役 在任期間 */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              社外取締役の在任期間
            </label>
            <select
              value={filters.outsideTenureMin ?? ""}
              onChange={e => setFilters(f => ({ ...f, outsideTenureMin: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">問わず</option>
              <option value="6">6年以上の候補者あり</option>
              <option value="8">8年以上の候補者あり</option>
              <option value="10">10年以上の候補者あり</option>
              <option value="12">12年以上の候補者あり</option>
              <option value="13">13年以上の候補者あり</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-400">在任期間が閾値以上の社外取締役が1人以上</p>
          </div>

          {/* 取締役会議長 */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              取締役会議長
            </label>
            <select
              value={filters.boardChairType}
              onChange={e => setFilters(f => ({ ...f, boardChairType: e.target.value as ScreenerFilters["boardChairType"] }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">問わず</option>
              <option value="outside">社外独立取締役が議長</option>
              <option value="inside">社内取締役が議長</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-400">取締役会議長の属性</p>
          </div>

          {/* 女性社外取締役 */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              女性社外取締役
            </label>
            <select
              value={filters.hasFemaleOutside}
              onChange={e => setFilters(f => ({ ...f, hasFemaleOutside: e.target.value as ScreenerFilters["hasFemaleOutside"] }))}
              className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">問わず</option>
              <option value="true">あり（1名以上）</option>
              <option value="false">なし</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-400">女性の社外取締役が在任</p>
          </div>
        </div>
      </div>

      {/* ── ボタン ── */}
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
