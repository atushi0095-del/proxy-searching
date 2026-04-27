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

function meetingYearFrom(value: string) {
  const match = String(value ?? "").match(/(\d{4})/);
  return match ? match[1] : "2025";
}

function companyDetailHref(record: OppositionRecord) {
  return `/companies/${record.company_code}?year=${meetingYearFrom(record.meeting_date)}`;
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
    () => [...new Set(investorRecords.map((record) => meetingYearFrom(record.meeting_date)))].sort((a, b) => b.localeCompare(a)),
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
      targets.add(`${record.company_code}:${meetingYearFrom(record.meeting_date)}`);
    }
    return targets;
  }, [investorRecords]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = investorRecords.filter((record) => {
      const hasReason = record.reason.trim().length > 0;
      const recordYear = meetingYearFrom(record.meeting_date);
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
      setVoteFilter("all");
      setIssueType("all");
      setDetailTag("all");
      setReasonFilter("all");
      setSortKey("company");
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

      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_120px_140px_180px_150px_180px_160px_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="企業名・コード・理由で検索"
          className="rounded border px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
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
        <select
          value={reasonFilter}
          onChange={(event) => setReasonFilter(event.target.value as "all" | "with" | "without")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">理由すべて</option>
          <option value="with">理由あり</option>
          <option value="without">理由なし</option>
        </select>
        <select
          value={analysisPreset}
          onChange={(event) => applyAnalysisPreset(event.target.value as "none" | "low_roe_director_elections")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="none">通常表示</option>
          <option value="low_roe_director_elections">ROE論点企業の選任議案</option>
        </select>
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as "default" | "company" | "meeting_date_desc" | "reason")}
          className="rounded border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="default">既定順</option>
          <option value="meeting_date_desc">総会日 新しい順</option>
          <option value="company">企業コード順</option>
          <option value="reason">理由あり優先</option>
        </select>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="rounded border bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          クリア
        </button>
      </div>

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
          <p className="text-xs text-green-700">賛成比較</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{forCount.toLocaleString()}</p>
          {forWithReasonCount > 0 && <p className="mt-1 text-[11px] text-green-700">理由あり {forWithReasonCount.toLocaleString()}件</p>}
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
              <th className="px-2 py-2 text-left font-semibold">推定論点</th>
              <th className="px-2 py-2 text-left font-semibold">理由</th>
              <th className="px-2 py-2 text-left font-semibold">出典</th>
            </tr>
          </thead>
          <tbody>
            {displayedWithGroups.map(({ record, isGroupStart, isGroupEnd, gIdx }, index) => (
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
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{isGroupStart ? (record.meeting_date ? record.meeting_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1/$2/$3") : "-") : ""}</td>
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
                <td className="px-2 py-1.5 text-slate-600 max-w-[160px]">
                  <p className="truncate">{record.proposal_type || "-"}</p>
                  <p className="text-slate-400">
                    {record.resolution_number || record.proposal_number ? `議案${record.resolution_number || record.proposal_number}` : ""}
                    {record.candidate_number ? `-${record.candidate_number}` : ""}
                  </p>
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
                  <p className="line-clamp-2 leading-5">{record.reason || <span className="text-slate-400">記載なし</span>}</p>
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
            ))}
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
