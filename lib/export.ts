import type { InvestorJudgment, IssueType } from "@/lib/types";
import { issueLabels } from "@/lib/inference";

export interface ExportRow {
  企業名: string;
  証券コード: string;
  年度: number;
  投資家名: string;
  論点: string;
  候補者名: string;
  現役職: string;
  反対可能性: string;
  根拠区分: string;
  注意事項: string;
}

export function buildExportRows(judgments: InvestorJudgment[]): ExportRow[] {
  const rows: ExportRow[] = [];

  for (const j of judgments) {
    const activeCandidates = j.opposition_candidates.filter((c) => c.issue_scores.length > 0);

    if (activeCandidates.length === 0) {
      // 反対対象なし行
      rows.push({
        企業名: j.company.company_name,
        証券コード: j.company.company_code,
        年度: j.meeting_year,
        投資家名: j.investor.investor_name,
        論点: "（反対対象候補なし）",
        候補者名: "—",
        現役職: "—",
        反対可能性: "Not likely",
        根拠区分: "—",
        注意事項: j.disclaimer,
      });
    } else {
      for (const candidate of activeCandidates) {
        for (const score of candidate.issue_scores) {
          rows.push({
            企業名: j.company.company_name,
            証券コード: j.company.company_code,
            年度: j.meeting_year,
            投資家名: j.investor.investor_name,
            論点: issueLabels[score.issue_type as IssueType] ?? score.issue_type,
            候補者名: candidate.director.name,
            現役職: candidate.director.current_title,
            反対可能性: score.level,
            根拠区分: score.basis,
            注意事項: j.disclaimer,
          });
        }
      }
    }
  }

  return rows;
}

export function rowsToCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]) as (keyof ExportRow)[];
  const escape = (v: string | number) => {
    const s = String(v);
    // CSVのダブルクォートエスケープ（RFC 4180）
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = headers.map((h) => escape(h)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escape(row[h])).join(",")
  );

  // BOM付きUTF-8（Excelで文字化けしないように）
  return "﻿" + [headerLine, ...dataLines].join("\r\n");
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
