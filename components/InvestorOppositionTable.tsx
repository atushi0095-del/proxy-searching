"use client";

import { useMemo, useState } from "react";

interface OppositionRecord {
  investor_id: string;
  company_code: string;
  company_name: string;
  meeting_date: string;
  proposal_number: string;
  proposal_type: string;
  director_or_role: string;
  vote: string;
  issue_type: string;
  reason: string;
  source_url: string;
  source_title: string;
}

interface Props {
  investorId: string;
  records: OppositionRecord[];
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
    "議案種類",
    "候補者/役割",
    "行使",
    "推定論点",
    "反対理由",
    "出典URL",
  ];
  const body = rows.map((row) =>
    [
      row.investor_id,
      row.company_code,
      row.company_name,
      row.meeting_date,
      row.proposal_number,
      row.proposal_type,
      row.director_or_role,
      row.vote,
      row.issue_type,
      row.reason,
      row.source_url,
    ].map(csvEscape).join(",")
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `investor_opposition_${investorId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function InvestorOppositionTable({ investorId, records }: Props) {
  const [query, setQuery] = useState("");
  const [issueType, setIssueType] = useState("all");

  const investorRecords = useMemo(
    () => records.filter((record) => record.investor_id === investorId),
    [records, investorId]
  );
  const issueTypes = useMemo(
    () => [...new Set(investorRecords.map((record) => record.issue_type))].sort(),
    [investorRecords]
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return investorRecords.filter((record) => {
      const matchesIssue = issueType === "all" || record.issue_type === issueType;
      const text = `${record.company_code} ${record.company_name} ${record.proposal_type} ${record.director_or_role} ${record.reason}`.toLowerCase();
      const matchesQuery = normalizedQuery === "" || text.includes(normalizedQuery);
      return matchesIssue && matchesQuery;
    });
  }, [investorRecords, issueType, query]);

  const displayed = filtered.slice(0, 200);

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">反対先一覧</h2>
          <p className="mt-1 text-xs text-slate-500">
            投資家が反対した企業、反対理由、推定論点を横断確認します。表示は最大200件、CSVは絞り込み後の全件を出力します。
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

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="企業名、コード、理由、候補者で検索"
          className="rounded border px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <select
          value={issueType}
          onChange={(event) => setIssueType(event.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">すべての論点</option>
          {issueTypes.map((issue) => (
            <option key={issue} value={issue}>
              {issue}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">反対レコード</p>
          <p className="mt-1 text-2xl font-bold">{investorRecords.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">絞り込み後</p>
          <p className="mt-1 text-2xl font-bold">{filtered.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">論点数</p>
          <p className="mt-1 text-2xl font-bold">{issueTypes.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">企業</th>
              <th className="px-3 py-2 text-left font-semibold">総会日</th>
              <th className="px-3 py-2 text-left font-semibold">議案</th>
              <th className="px-3 py-2 text-left font-semibold">推定論点</th>
              <th className="px-3 py-2 text-left font-semibold">反対理由</th>
              <th className="px-3 py-2 text-left font-semibold">出典</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayed.map((record, index) => (
              <tr key={`${record.investor_id}-${record.company_code}-${record.meeting_date}-${record.proposal_number}-${index}`} className="align-top">
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{record.company_name || record.company_code}</p>
                  <p className="text-slate-500">{record.company_code}</p>
                </td>
                <td className="px-3 py-2 text-slate-600">{record.meeting_date || "-"}</td>
                <td className="px-3 py-2 text-slate-600">
                  <p>{record.proposal_type || "-"}</p>
                  <p>{record.director_or_role}</p>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{record.issue_type}</span>
                </td>
                <td className="max-w-md px-3 py-2 leading-5 text-slate-700">{record.reason || "理由記載なし"}</td>
                <td className="px-3 py-2">
                  {record.source_url ? (
                    <a className="text-blue-700 hover:underline" href={record.source_url} target="_blank" rel="noreferrer">
                      開く
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > displayed.length && (
        <p className="mt-2 text-xs text-slate-500">画面表示は先頭200件です。CSVには絞り込み後の全{filtered.length.toLocaleString()}件を出力します。</p>
      )}
      {investorRecords.length === 0 && (
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          この投資家はまだ個別行使結果の反対先一覧が生成されていません。次の収集対象として、公式Excel/PDFの解析を追加します。
        </p>
      )}
    </section>
  );
}
