"use client";

import { useCallback, useState } from "react";
import type { InvestorJudgment } from "@/lib/types";
import { buildExportRows, rowsToCsv, downloadCsv } from "@/lib/export";

interface Props {
  judgments: InvestorJudgment[];
  companyCode: string;
  meetingYear: number;
}

export function ExportButton({ judgments, companyCode, meetingYear }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(() => {
    setLoading(true);
    try {
      const rows = buildExportRows(judgments);
      const csv = rowsToCsv(rows);
      const filename = `proxy-vote-analysis_${companyCode}_${meetingYear}.csv`;
      downloadCsv(csv, filename);
    } finally {
      setLoading(false);
    }
  }, [judgments, companyCode, meetingYear]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 rounded border bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
    >
      <svg
        className="h-4 w-4 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
        />
      </svg>
      {loading ? "出力中…" : "CSVエクスポート"}
    </button>
  );
}
