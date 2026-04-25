"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── 議案キーワードマッピング ───────────────────────────────────────────────────
// 議案種別の検索語と一致するissue_type群のマッピング
const PROPOSAL_KEYWORDS: Record<string, string[]> = {
  選任: ["tenure", "board_independence", "outside_director_ratio", "gender_diversity", "attendance", "overboarding", "independence_failure", "outside_director_independence", "board_chair_independence"],
  "取締役選任": ["tenure", "board_independence", "outside_director_ratio", "gender_diversity"],
  "役員選任": ["tenure", "board_independence", "gender_diversity"],
  "社外取締役": ["tenure", "outside_director_ratio", "outside_director_independence"],
  報酬: ["compensation"],
  "株式報酬": ["compensation"],
  "役員報酬": ["compensation"],
  "報酬議案": ["compensation"],
  "買収防衛": ["takeover_defense"],
  "ポイズンピル": ["takeover_defense"],
  "防衛策": ["takeover_defense"],
  "株主提案": ["shareholder_proposal"],
  "政策保有": ["policy_shareholdings"],
  "持ち合い": ["policy_shareholdings"],
  ROE: ["low_roe"],
  PBR: ["low_pbr"],
  TSR: ["low_tsr"],
  業績: ["low_roe", "low_tsr", "low_pbr"],
  独立性: ["board_independence", "outside_director_independence", "independence_failure", "board_chair_independence"],
  多様性: ["gender_diversity"],
  "女性": ["gender_diversity"],
  在任: ["tenure"],
  "長期在任": ["tenure"],
  出席: ["attendance"],
  "出席率": ["attendance"],
  兼職: ["overboarding"],
};

// ─── 型定義 ──────────────────────────────────────────────────────────────────
export interface SearchCompany {
  code: string;
  name: string;
  market: string;
  sector: string;
}

export interface SearchInvestor {
  id: string;
  name: string;
  country: string;
  type: string;
}

export interface SearchRule {
  ruleId: string;
  investorId: string;
  investorName: string;
  issueType: string;
  issueLabel: string;
  category: string;
  conditionText: string;
  summaryText: string;
}

interface Props {
  companies: SearchCompany[];
  investors: SearchInvestor[];
  rules: SearchRule[];
}

type ResultType = "company" | "investor" | "rule";

interface BaseResult {
  type: ResultType;
  href: string;
  label: string;
  sub: string;
  tag?: string;
}

// ─── 検索ロジック ──────────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "");
}

function matchKeyword(query: string, texts: string[]): boolean {
  const q = normalize(query);
  return texts.some((t) => normalize(t).includes(q));
}

function getProposalMatchedIssueTypes(query: string): string[] {
  const q = normalize(query);
  const matched: string[] = [];
  for (const [keyword, types] of Object.entries(PROPOSAL_KEYWORDS)) {
    if (normalize(keyword).includes(q) || q.includes(normalize(keyword))) {
      matched.push(...types);
    }
  }
  return [...new Set(matched)];
}

function searchAll(
  query: string,
  companies: SearchCompany[],
  investors: SearchInvestor[],
  rules: SearchRule[]
): BaseResult[] {
  if (!query.trim()) return [];
  const results: BaseResult[] = [];

  // 企業検索
  for (const c of companies) {
    if (matchKeyword(query, [c.code, c.name, c.market, c.sector])) {
      results.push({
        type: "company",
        href: `/companies/${c.code}?year=2025`,
        label: c.name,
        sub: `${c.code} / ${c.market} / ${c.sector}`,
        tag: "企業",
      });
    }
  }

  // 投資家検索
  for (const inv of investors) {
    if (matchKeyword(query, [inv.name, inv.country, inv.type])) {
      results.push({
        type: "investor",
        href: `/investors/${inv.id}`,
        label: inv.name,
        sub: `${inv.country} / ${inv.type}`,
        tag: "投資家",
      });
    }
  }

  // 議案・基準検索（論点単位で集約 — 同じissueTypeは1件にまとめる）
  const proposalMatchedTypes = getProposalMatchedIssueTypes(query);
  // issueType → ルール群 にグループ化
  const rulesByIssue = new Map<string, SearchRule[]>();
  for (const rule of rules) {
    if (!rulesByIssue.has(rule.issueType)) rulesByIssue.set(rule.issueType, []);
    rulesByIssue.get(rule.issueType)!.push(rule);
  }
  for (const [issueType, issueRules] of rulesByIssue) {
    const first = issueRules[0];
    const textMatch = matchKeyword(query, [
      first.issueLabel,
      first.category,
      first.conditionText,
      first.summaryText,
      issueType,
    ]);
    const proposalMatch = proposalMatchedTypes.includes(issueType);
    if (textMatch || proposalMatch) {
      const investorList = issueRules.map((r) => r.investorName).join("・");
      results.push({
        type: "rule",
        href: `/issues/${issueType}`,
        label: first.issueLabel,
        sub: `${issueRules.length}投資家が基準保有（${investorList}） — ${first.summaryText}`,
        tag: first.category,
      });
    }
  }

  return results;
}

// ─── コンポーネント ────────────────────────────────────────────────────────────
const typeStyle: Record<ResultType, string> = {
  company: "bg-indigo-50 text-indigo-700",
  investor: "bg-blue-50 text-blue-700",
  rule: "bg-amber-50 text-amber-700",
};

const typeLabel: Record<ResultType, string> = {
  company: "企業",
  investor: "投資家",
  rule: "基準・議案",
};

export function SearchBox({ companies, investors, rules }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = searchAll(query, companies, investors, rules);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
  }, []);

  const handleFocus = useCallback(() => {
    if (query.trim()) setOpen(true);
  }, [query]);

  const handleResultClick = useCallback(() => {
    setQuery("");
    setOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    },
    []
  );

  const showPanel = open && query.trim().length > 0;

  // 結果をタイプ別にグループ化（最大表示数を制限）
  const grouped = {
    company: results.filter((r) => r.type === "company").slice(0, 5),
    investor: results.filter((r) => r.type === "investor").slice(0, 3),
    rule: results.filter((r) => r.type === "rule").slice(0, 8),
  };
  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* 検索入力 */}
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="証券コード・投資家名・議案（選任、株式報酬、買収防衛など）で検索"
          className="w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
          aria-label="検索"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-3 text-slate-400 hover:text-slate-600"
            aria-label="クリア"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 検索結果パネル */}
      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border bg-white shadow-xl">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              「{query}」に一致する企業・投資家・基準が見つかりません。
            </div>
          ) : (
            <div className="divide-y">
              {/* 企業 */}
              {grouped.company.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">企業</p>
                  {grouped.company.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      onClick={handleResultClick}
                      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${typeStyle.company}`}>
                        {typeLabel.company}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{r.label}</p>
                        <p className="text-xs text-slate-500 truncate">{r.sub}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* 投資家 */}
              {grouped.investor.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">投資家</p>
                  {grouped.investor.map((r) => (
                    <Link
                      key={r.href + r.label}
                      href={r.href}
                      onClick={handleResultClick}
                      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${typeStyle.investor}`}>
                        {typeLabel.investor}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{r.label}</p>
                        <p className="text-xs text-slate-500 truncate">{r.sub}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* 基準・議案 */}
              {grouped.rule.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">基準・議案</p>
                  {grouped.rule.map((r, i) => (
                    <Link
                      key={`${r.href}-${i}`}
                      href={r.href}
                      onClick={handleResultClick}
                      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${typeStyle.rule}`}>
                        {r.tag ?? typeLabel.rule}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{r.label}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-5">{r.sub}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* 件数フッター */}
              <div className="px-4 py-2 text-right text-xs text-slate-400">
                {results.length}件ヒット
              </div>
            </div>
          )}
        </div>
      )}

      {/* 検索ヒント（空欄時） */}
      {!query && (
        <div className="mt-2 flex flex-wrap gap-2">
          {["選任議案", "株式報酬", "在任期間", "取締役会の独立性", "女性取締役", "買収防衛策", "ROE", "7203", "BlackRock"].map(
            (hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => { setQuery(hint); setOpen(true); }}
                className="rounded-full border bg-white px-3 py-1 text-xs text-slate-500 transition hover:border-blue-300 hover:text-blue-700"
              >
                {hint}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
