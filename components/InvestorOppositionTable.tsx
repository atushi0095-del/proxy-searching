"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface OppositionRecord {
  investor_id: string;
  company_code: string;
  company_name: string;
  meeting_date: string;
  proposal_number: string;
  resolution_number?: string;
  candidate_number?: string;
  proposal_type: string;
  proposal_title_normalized?: string;
  director_or_role: string;
  vote: string;
  issue_type: string;
  detail_tags?: string[];
  target_label?: string;
  target_resolution_type?: string;
  target_candidate_number?: string;
  match_method?: string;
  target_confidence?: string;
  target_notes?: string;
  matched_director_id?: string;
  matched_director_name?: string;
  matched_director_title?: string;
  matched_director_attributes?: string[];
  director_match_method?: string;
  director_match_confidence?: string;
  director_match_notes?: string;
  reason: string;
  source_url: string;
  source_title: string;
  convocation_notice_url?: string;
}

interface Props {
  investorId: string;
  records: OppositionRecord[];
}

const issueLabels: Record<string, string> = {
  attendance: "出席率",
  board_independence: "取締役会独立性",
  board_chair_independence: "議長独立性",
  compensation: "役員報酬",
  gender_diversity: "女性・ジェンダー",
  independence_failure: "独立性欠如",
  low_pbr: "PBR",
  low_roe: "ROE・資本効率",
  low_tsr: "TSR・株価",
  outside_director_independence: "社外取締役独立性",
  outside_director_ratio: "独立社外比率",
  overboarding: "兼職数",
  policy_shareholdings: "政策保有株式",
  shareholder_proposal: "株主提案",
  takeover_defense: "買収防衛策",
  tenure: "在任期間",
  other: "その他",
};

function issueLabel(issue: string) {
  return issueLabels[issue] ?? issue;
}

/**
 * 総会年を取得: meeting_date → なければ proposal_type の先頭8桁から
 */
function meetingYearFrom(value: string, proposalType?: string): string {
  const match = String(value ?? "").match(/(\d{4})/);
  if (match) return match[1];
  if (proposalType) {
    const m2 = String(proposalType).match(/^(\d{4})/);
    if (m2) return m2[1];
  }
  return "2025";
}

/**
 * 総会日を整形: 定時プレフィックス除去、臨時バッジ用フラグ返却
 * meeting_date が空の場合は proposal_type の先頭8桁を使用
 */
function formatMeetingDate(meetingDate: string, proposalType?: string): { date: string; isExtraordinary: boolean } {
  let s = String(meetingDate ?? "");
  // meeting_date が空 or 8桁数字なしなら proposal_type から取得
  if (!s || !/\d{8}/.test(s)) {
    const m = String(proposalType ?? "").match(/^(\d{8})/);
    if (m) s = m[1];
  }
  const isExtraordinary = s.startsWith("臨時");
  const stripped = s.replace(/^(定時|臨時)/, "");
  const formatted = stripped.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1/$2/$3");
  return { date: formatted || "-", isExtraordinary };
}

/**
 * proposal_type から先頭の8桁日付を除去して議案種別だけ返す
 * "20250826会社取締役の選解任" → "取締役の選解任"
 */
function cleanProposalType(proposalType: string): string {
  return (proposalType ?? "").replace(/^\d{8}/, "").replace(/^会社/, "").trim();
}

/**
 * 議案番号と理由テキストを取得
 * ① resolution_number / proposal_number がある場合 → そのまま使う
 * ② ない場合 → reason の先頭数字（例: "3.13分の1..." → 議案番号3.13・理由"分の1..."）を分離
 */
function extractProposalAndReason(record: OppositionRecord): {
  proposalLabel: string;
  cleanReason: string;
} {
  const base = record.resolution_number || record.proposal_number;
  if (base) {
    const cand = record.candidate_number;
    return {
      proposalLabel: cand ? `議案${base}-${cand}` : `議案${base}`,
      cleanReason: record.reason ?? "",
    };
  }
  // reason 先頭の数字を議案番号として抽出
  const m = (record.reason ?? "").match(/^([\d]+(?:\.[\d]+)?)([\s\S]*)/);
  if (m) {
    return { proposalLabel: `議案${m[1]}`, cleanReason: m[2].trim() };
  }
  return { proposalLabel: "", cleanReason: record.reason ?? "" };
}

/** 候補者肩書からバッジ色を決定 */
function titleBadgeClass(title: string): string {
  if (/社長/.test(title) && !/副社長/.test(title)) return "bg-red-100 text-red-800";
  if (/代表取締役会長|代表会長/.test(title)) return "bg-orange-100 text-orange-800";
  if (/会長/.test(title)) return "bg-orange-50 text-orange-700";
  if (/専務/.test(title)) return "bg-amber-100 text-amber-800";
  if (/常務/.test(title)) return "bg-amber-50 text-amber-700";
  if (/代表取締役/.test(title)) return "bg-orange-50 text-orange-700";
  if (/社外取締役|独立/.test(title)) return "bg-blue-50 text-blue-700";
  if (/監査役/.test(title)) return "bg-yellow-50 text-yellow-700";
  if (/副社長/.test(title)) return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-600";
}

/** 属性バッジ（男性など不要なものを除外し、色付きで表示） */
function attrBadgeConfig(attr: string): { color: string } | null {
  if (attr === "男性") return null; // 表示不要
  if (/社長|CEO/.test(attr)) return { color: "bg-red-100 text-red-800" };
  if (/代表取締役会長|代表会長/.test(attr)) return { color: "bg-orange-100 text-orange-800" };
  if (/代表権/.test(attr)) return { color: "bg-orange-50 text-orange-700" };
  if (/会長/.test(attr)) return { color: "bg-orange-50 text-orange-700" };
  if (/専務|常務/.test(attr)) return { color: "bg-amber-100 text-amber-800" };
  if (/議長/.test(attr)) return { color: "bg-purple-50 text-purple-700" };
  if (/社外取締役/.test(attr)) return { color: "bg-blue-50 text-blue-700" };
  if (/社外/.test(attr)) return { color: "bg-blue-50 text-blue-700" };
  if (/非独立/.test(attr)) return { color: "bg-slate-200 text-slate-600" };
  if (/独立/.test(attr)) return { color: "bg-green-50 text-green-700" };
  if (/女性/.test(attr)) return { color: "bg-rose-50 text-rose-700" };
  if (/社内取締役/.test(attr)) return { color: "bg-slate-100 text-slate-700" };
  if (/再任後在任|総会前在任|在任/.test(attr)) return { color: "bg-amber-50 text-amber-700" };
  if (/出席率|取締役会出席|委員会出席/.test(attr)) return { color: "bg-teal-50 text-teal-700" };
  if (/兼職/.test(attr)) return { color: "bg-slate-100 text-slate-600" };
  return { color: "bg-slate-100 text-slate-600" };
}

function companyDetailHref(record: OppositionRecord) {
  return `/companies/${record.company_code}?year=${meetingYearFrom(record.meeting_date, record.proposal_type)}`;
}

function convocationNoticeUrl(record: OppositionRecord) {
  return record.convocation_notice_url || null;
}

function csvEscape(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(rows: OppositionRecord[], investorId: string) {
  const headers = [
    "投資家ID",
    "企業コード",
    "企業名",
    "総会日",
    "議案番号",
    "候補者番号",
    "議案種類",
    "反対対象候補",
    "対象推定方法",
    "対象推定信頼度",
    "照合候補者名",
    "照合候補者肩書",
    "候補者属性",
    "候補者照合方法",
    "候補者照合信頼度",
    "候補者/役割",
    "行使",
    "推定論点",
    "詳細条件",
    "理由",
    "出典URL",
    "招集通知URL",
  ];
  const body = rows.map((row) =>
    [
      row.investor_id,
      row.company_code,
      row.company_name,
      row.meeting_date,
      row.resolution_number || row.proposal_number,
      row.candidate_number ?? "",
      row.proposal_type,
      row.target_label ?? "",
      row.match_method ?? "",
      row.target_confidence ?? "",
      row.matched_director_name ?? "",
      row.matched_director_title ?? "",
      (row.matched_director_attributes ?? []).join(" / "),
      row.director_match_method ?? "",
      row.director_match_confidence ?? "",
      row.director_or_role,
      row.vote,
      issueLabel(row.issue_type),
      (row.detail_tags ?? []).join(" / "),
      row.reason,
      row.source_url,
      convocationNoticeUrl(row) ?? "",
    ].map(csvEscape).join(",")
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `投資家別_行使結果_${investorId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function InvestorOppositionTable({ investorId, records }: Props) {
  const [query, setQuery] = useState("");
  const [issueType, setIssueType] = useState("all");
  const [voteFilter, setVoteFilter] = useState<"all" | "against" | "for">("against");
  const [detailTag, setDetailTag] = useState("all");
  const [reasonFilter, setReasonFilter] = useState<"all" | "with" | "without">("all");
  const [sortKey, setSortKey] = useState<"default" | "company" | "meeting_date_desc" | "reason">("default");
  const [yearFilter, setYearFilter] = useState("latest");
  const [analysisPreset, setAnalysisPreset] = useState<"none" | "low_roe_director_elections">("none");

  const investorRecords = useMemo(
    () => records.filter((record) => record.investor_id === investorId),
    [records, investorId]
  );

  const issueTypes = useMemo(
    () => [...new Set(investorRecords.map((record) => record.issue_type))].sort(),
    [investorRecords]
  );

  const detailTags = useMemo(
    () => [...new Set(investorRecords.flatMap((record) => record.detail_tags ?? []))].sort(),
    [investorRecords]
  );

  const meetingYears = useMemo(
    () => [...new Set(investorRecords.map((record) => meetingYearFrom(record.meeting_date, record.proposal_type)))].sort((a, b) => b.localeCompare(a)),
    [investorRecords]
  );

  const latestYear = meetingYears[0] ?? "all";

  function isAgainstVote(vote: string) {
    return vote === "反対" || vote === "判断" || vote.includes("反対") || vote.includes("該当");
  }

  function isDirectorElection(record: OppositionRecord) {
    const text = `${record.proposal_type} ${record.proposal_title_normalized ?? ""}`;
    return /取締役|監査等委員|選任|選解任/.test(text);
  }

  const lowRoeCompanyYears = useMemo(() => {
    const targets = new Set<string>();
    for (const record of investorRecords) {
      if (record.issue_type !== "low_roe") continue;
      if (!isAgainstVote(record.vote)) continue;
      targets.add(`${record.company_code}:${meetingYearFrom(record.meeting_date, record.proposal_type)}`);
    }
    return targets;
  }, [investorRecords]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = investorRecords.filter((record) => {
      const hasReason = record.reason.trim().length > 0;
      const recordYear = meetingYearFrom(record.meeting_date, record.proposal_type);
      const effectiveYear = yearFilter === "latest" ? latestYear : yearFilter;
      const matchesYear = effectiveYear === "all" || recordYear === effectiveYear;
      const matchesVote =
        voteFilter === "all" ||
        (voteFilter === "against" && isAgainstVote(record.vote)) ||
        (voteFilter === "for" && record.vote === "賛成");
      const matchesPreset =
        analysisPreset === "none" ||
        (
          analysisPreset === "low_roe_director_elections" &&
          lowRoeCompanyYears.has(`${record.company_code}:${recordYear}`) &&
          isDirectorElection(record)
        );
      const matchesIssue = analysisPreset !== "none" || issueType === "all" || record.issue_type === issueType;
      const matchesDetail = detailTag === "all" || (record.detail_tags ?? []).includes(detailTag);
      const matchesReason =
        reasonFilter === "all" ||
        (reasonFilter === "with" && hasReason) ||
        (reasonFilter === "without" && !hasReason);
      const searchText = `${record.company_code} ${record.company_name} ${record.proposal_type} ${record.director_or_role} ${record.reason}`.toLowerCase();
      const matchesQuery = normalizedQuery === "" || searchText.includes(normalizedQuery);
      return matchesYear && matchesVote && matchesPreset && matchesIssue && matchesDetail && matchesReason && matchesQuery;
    });
    return [...rows].sort((a, b) => {
      if (sortKey === "company") {
        return a.company_code.localeCompare(b.company_code) || b.meeting_date.localeCompare(a.meeting_date);
      }
      if (sortKey === "meeting_date_desc") {
        return b.meeting_date.localeCompare(a.meeting_date) || a.company_code.localeCompare(b.company_code);
      }
      if (sortKey === "reason") {
        const reasonDiff = Number(b.reason.trim().length > 0) - Number(a.reason.trim().length > 0);
        return reasonDiff || a.company_code.localeCompare(b.company_code) || b.meeting_date.localeCompare(a.meeting_date);
      }
      return 0;
    });
  }, [investorRecords, voteFilter, issueType, detailTag, reasonFilter, sortKey, yearFilter, latestYear, analysisPreset, lowRoeCompanyYears, query]);

  const displayed = filtered.slice(0, 200);
  const againstCount = investorRecords.filter((record) => isAgainstVote(record.vote)).length;
  const forCount = investorRecords.filter((record) => record.vote === "賛成").length;
  const forWithReasonCount = investorRecords.filter((record) => record.vote === "賛成" && record.reason.trim().length > 0).length;
  const hasActiveFilters =
    query !== "" ||
    issueType !== "all" ||
    voteFilter !== "against" ||
    detailTag !== "all" ||
    reasonFilter !== "all" ||
    sortKey !== "default" ||
    yearFilter !== "latest" ||
    analysisPreset !== "none";

  // Group consecutive rows by (company_code, meeting_date) for visual grouping
  const displayedWithGroups = useMemo(() => {
    let gIdx = 0;
    return displayed.map((record, index) => {
      const prev = displayed[index - 1];
      const isGroupStart = !prev || prev.company_code !== record.company_code || prev.meeting_date !== record.meeting_date;
      if (isGroupStart && index > 0) gIdx++;
      const next = displayed[index + 1];
      const isGroupEnd = !next || next.company_code !== record.company_code || next.meeting_date !== record.meeting_date;
      return { record, isGroupStart, isGroupEnd, gIdx };
    });
  }, [displayed]);

  function clearFilters() {
    setQuery("");
    setIssueType("all");
    setVoteFilter("against");
    setDetailTag("all");
    setReasonFilter("all");
    setSortKey("default");
    setYearFilter("latest");
    setAnalysisPreset("none");
  }

  function applyAnalysisPreset(value: "none" | "low_roe_director_elections") {
    setAnalysisPreset(value);
    if (value === "low_roe_director_elections") {
      setVoteFilter("all");   // 賛否両方表示
      setIssueType("all");    // 論点フィルターを無効化（プリセット優先）
      setDetailTag("all");
      setReasonFilter("all");
      setSortKey("company");  // 企業単位でグループ化しやすいように
      setYearFilter("all");   // 全期間: ROE違反が過去年の場合も拾う
    }
  }

  function displayIssue(record: OppositionRecord) {
    if (record.vote === "賛成" && record.reason.trim().length === 0) {
      return <span className="text-slate-400">分類なし</span>;
    }
    return issueLabel(record.issue_type);
  }

  function needsQualityCheck(record: OppositionRecord) {
    return record.vote === "賛成" && record.reason.trim().length > 0;
  }

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">行使先一覧</h2>
          <p className="mt-1 text-xs text-slate-500">
            投資家が反対・賛成した企業、理由、推定論点、候補者属性を横断確認します。CSVは絞り込み後の全件を出力します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(filtered, investorId)}
          className="rounded border bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
        >
          CSV出力
        </button>
      </div>

      {/* フィルター行1: 主要フィルター */}
      <div className="mb-2 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="企業名・コード・理由で検索"
          className="min-w-[180px] flex-1 rounded border px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <select
          value={voteFilter}
          onChange={(event) => setVoteFilter(event.target.value as "all" | "against" | "for")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="against">反対のみ</option>
          <option value="for">賛成のみ</option>
          <option value="all">全行使</option>
        </select>
        <select
          value={issueType}
          onChange={(event) => setIssueType(event.target.value)}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">すべての論点</option>
          {issueTypes.map((issue) => (
            <option key={issue} value={issue}>
              {issueLabel(issue)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="rounded border bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          クリア
        </button>
      </div>
      {/* フィルター行2: 詳細フィルター */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={yearFilter}
          onChange={(event) => setYearFilter(event.target.value)}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="latest">最新年</option>
          <option value="all">全期間</option>
          {meetingYears.map((year) => (
            <option key={year} value={year}>{year}年</option>
          ))}
        </select>
        <select
          value={reasonFilter}
          onChange={(event) => setReasonFilter(event.target.value as "all" | "with" | "without")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">理由：すべて</option>
          <option value="with">理由あり</option>
          <option value="without">理由なし</option>
        </select>
        <select
          value={analysisPreset}
          onChange={(event) => applyAnalysisPreset(event.target.value as "none" | "low_roe_director_elections")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="none">プリセット：通常</option>
          <option value="low_roe_director_elections">ROE論点企業の選任議案</option>
        </select>
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as "default" | "company" | "meeting_date_desc" | "reason")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="default">並順：既定</option>
          <option value="meeting_date_desc">総会日 新しい順</option>
          <option value="company">企業コード順</option>
          <option value="reason">理由あり優先</option>
        </select>
      </div>

      {/* プリセット適用中バナー */}
      {analysisPreset === "low_roe_director_elections" && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-amber-900">ROE論点企業の選任議案プリセット適用中</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                ROE基準への反対実績がある企業の<strong>全選任議案</strong>を表示しています（賛否両方）。
                同一企業内で「誰に反対し、誰に賛成したか」を横断確認できます。企業コード順で並んでいます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setAnalysisPreset("none"); setVoteFilter("against"); setYearFilter("latest"); setSortKey("default"); }}
              className="shrink-0 rounded border border-amber-300 bg-white px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
            >
              プリセットを解除
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-amber-700">
            <span>対象企業数: <strong>{new Set(filtered.map(r => r.company_code)).size}社</strong></span>
            <span>反対: <strong className="text-red-700">{filtered.filter(r => isAgainstVote(r.vote) && r.vote !== "賛成").length.toLocaleString()}件</strong></span>
            <span>賛成: <strong className="text-green-700">{filtered.filter(r => r.vote === "賛成").length.toLocaleString()}件</strong></span>
          </div>
        </div>
      )}

      <div className="mb-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">全レコード</p>
          <p className="mt-1 text-2xl font-bold">{investorRecords.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-3">
          <p className="text-xs text-red-700">反対</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{againstCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-3">
          <p className="text-xs text-green-700">賛成（比較用）</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{forCount.toLocaleString()}</p>
          {forWithReasonCount > 0 && <p className="mt-0.5 text-[11px] text-green-700">うち理由あり {forWithReasonCount.toLocaleString()}件</p>}
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">絞り込み後</p>
          <p className="mt-1 text-2xl font-bold">{filtered.length.toLocaleString()}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">企業</th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">総会日</th>
              <th className="px-2 py-2 text-left font-semibold">行使</th>
              <th className="px-2 py-2 text-left font-semibold">議案</th>
              <th className="px-2 py-2 text-left font-semibold">候補者・属性</th>
              <th className="px-2 py-2 text-left font-semibold">推定論点</th>
              <th className="px-2 py-2 text-left font-semibold">理由</th>
              <th className="px-2 py-2 text-left font-semibold">出典</th>
            </tr>
          </thead>
          <tbody>
            {displayedWithGroups.map(({ record, isGroupStart, isGroupEnd, gIdx }, index) => {
              const { date: meetingDateStr, isExtraordinary } = formatMeetingDate(record.meeting_date, record.proposal_type);
              const { proposalLabel, cleanReason } = extractProposalAndReason(record);
              const proposalTypeDisplay = cleanProposalType(record.proposal_type);
              return (
              <tr
                key={`${record.investor_id}-${record.company_code}-${record.meeting_date}-${record.proposal_number}-${index}`}
                className={`align-top ${gIdx % 2 === 0 ? "" : "bg-slate-50/60"} ${isGroupEnd ? "border-b border-slate-200" : ""}`}
              >
                <td className="px-3 py-1.5">
                  {isGroupStart ? (
                    <>
                      <Link href={companyDetailHref(record)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                        {record.company_name || record.company_code}
                      </Link>
                      <p className="text-slate-400">{record.company_code}</p>
                    </>
                  ) : (
                    <span className="text-slate-300 pl-1">↳</span>
                  )}
                </td>
                {/* 総会日: 定時は除去、臨時のみバッジ表示 */}
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                  {isGroupStart ? (
                    <>
                      <p className="text-slate-700">{meetingDateStr}</p>
                      {isExtraordinary && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">臨時</span>
                      )}
                    </>
                  ) : ""}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${
                    isAgainstVote(record.vote) && record.vote !== "賛成"
                      ? record.vote === "判断" ? "bg-orange-50 text-orange-700" : "bg-red-100 text-red-700"
                      : record.vote === "棄権" ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-700"
                  }`}>
                    {record.vote || "-"}
                  </span>
                </td>
                {/* 議案: 種別 + 議案番号を明示 */}
                <td className="px-2 py-1.5 text-slate-600 max-w-[200px]">
                  <p className="truncate text-[12px]">{proposalTypeDisplay || "-"}</p>
                  {proposalLabel && (
                    <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 rounded px-1.5 py-0.5 inline-block">
                      {proposalLabel}
                    </p>
                  )}
                </td>
                {/* 候補者・属性列: 肩書バッジ＋属性バッジ */}
                <td className="px-2 py-1.5 max-w-[220px]">
                  {record.matched_director_name ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="font-semibold text-slate-900 text-[12px] leading-5">{record.matched_director_name}</p>
                      {/* 肩書をバッジで表示 */}
                      {record.matched_director_title && (
                        <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${titleBadgeClass(record.matched_director_title)}`}>
                          {record.matched_director_title}
                        </span>
                      )}
                      {/* 属性バッジ（男性を除外、重複排除） */}
                      {(record.matched_director_attributes ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {record.matched_director_attributes!
                            .map((attr) => ({ attr, cfg: attrBadgeConfig(attr) }))
                            .filter(({ cfg }) => cfg !== null)
                            .map(({ attr, cfg }) => (
                              <span key={attr} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${cfg!.color}`}>
                                {attr}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-[11px]">未特定</span>
                  )}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{displayIssue(record)}</span>
                </td>
                <td className="px-2 py-1.5 text-slate-700 max-w-[260px]">
                  {needsQualityCheck(record) && (
                    <span className="mb-1 inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      賛成理由あり・要確認
                    </span>
                  )}
                  <p className="line-clamp-2 leading-5">{cleanReason || <span className="text-slate-400">記載なし</span>}</p>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {record.source_url ? (
                    <a className="text-blue-600 hover:underline" href={record.source_url} target="_blank" rel="noreferrer">開く</a>
                  ) : convocationNoticeUrl(record) ? (
                    <a className="text-emerald-700 hover:underline" href={convocationNoticeUrl(record)!} target="_blank" rel="noreferrer" title="招集通知">通知</a>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > displayed.length && (
        <p className="mt-2 text-xs text-slate-500">
          画面表示は先頭200件です。CSVには絞り込み後の全{filtered.length.toLocaleString()}件を出力します。
        </p>
      )}
      {investorRecords.length === 0 && (
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          この投資家はまだ個別行使結果の一覧が生成されていません。次の収集対象として、公式Excel/PDFの解析を追加します。
        </p>
      )}
    </section>
  );
}
