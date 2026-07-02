import type { NextRequest } from "next/server";
import {
  getInvestorFacets,
  queryBoundary,
  queryConditions,
  queryList,
  type ConditionFilter,
  type ListFilter,
  type MetricKey,
  type Operator,
} from "@/lib/analysis-db";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ investorId: string }>;
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

function csvEscape(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const CSV_MAX_ROWS = 50000;

function recordsToCsv(rows: ReturnType<typeof queryList>["rows"], investorId: string): Response {
  const headers = [
    "投資家ID", "企業コード", "企業名", "総会日", "議案番号", "候補者番号", "議案種類",
    "反対対象候補", "対象推定方法", "対象推定信頼度",
    "照合候補者名", "照合候補者肩書", "候補者属性", "候補者照合方法", "候補者照合信頼度",
    "候補者/役割", "行使", "推定論点", "詳細条件", "理由", "出典URL", "招集通知URL",
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
      row.matched_director_attributes.join(" / "),
      row.director_match_method ?? "",
      row.director_match_confidence ?? "",
      row.director_or_role,
      row.vote,
      issueLabels[row.issue_type] ?? row.issue_type,
      row.detail_tags.join(" / "),
      row.reason,
      row.source_url,
      row.convocation_notice_url ?? "",
    ].map(csvEscape).join(",")
  );
  const csv = `﻿${[headers.join(","), ...body].join("\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="votes_${investorId}.csv"`,
    },
  });
}

export async function GET(request: NextRequest, context: Context) {
  const { investorId } = await context.params;
  const sp = request.nextUrl.searchParams;
  const mode = sp.get("mode") ?? "list";
  const format = sp.get("format") ?? "json";

  if (mode === "facets") {
    return Response.json(getInvestorFacets(investorId));
  }

  if (mode === "list") {
    const filter: ListFilter = {
      year: sp.get("year") ?? "latest",
      vote: (sp.get("vote") as ListFilter["vote"]) ?? "against",
      issueType: sp.get("issueType") ?? "all",
      detailTag: sp.get("detailTag") ?? "all",
      reason: (sp.get("reason") as ListFilter["reason"]) ?? "all",
      sort: (sp.get("sort") as ListFilter["sort"]) ?? "default",
      preset: (sp.get("preset") as ListFilter["preset"]) ?? "none",
      query: sp.get("q") ?? "",
      limit: format === "csv" ? CSV_MAX_ROWS : Math.min(Number(sp.get("limit")) || 200, 500),
    };
    const result = queryList(investorId, filter);
    if (format === "csv") return recordsToCsv(result.rows, investorId);
    return Response.json(result);
  }

  if (mode === "conditions") {
    const filter: ConditionFilter = {
      vote: (sp.get("vote") as ConditionFilter["vote"]) ?? "all",
      issueType: sp.get("issueType") ?? "all",
      detailTag: sp.get("detailTag") ?? "all",
      roleCondition: sp.get("role") ?? "all",
      keyword: sp.get("q") ?? "",
      metricKey: (sp.get("metricKey") as MetricKey) ?? "none",
      metricOperator: (sp.get("metricOp") as Operator) ?? "none",
      metricThreshold: sp.get("metricThreshold") ?? "",
      metricPeriods: sp.get("metricPeriods") ?? "1",
      expandCompanies: sp.get("expand") === "1",
      limit: format === "csv" ? CSV_MAX_ROWS : Math.min(Number(sp.get("limit")) || 300, 500),
    };
    if (sp.get("countOnly") === "1") {
      const result = queryConditions(investorId, { ...filter, limit: 0 });
      return Response.json({ totalMatched: result.totalMatched });
    }
    const result = queryConditions(investorId, filter);
    if (format === "csv") return recordsToCsv(result.rows, investorId);
    return Response.json(result);
  }

  if (mode === "boundary") {
    const metric = (sp.get("metric") as MetricKey) ?? "roe";
    const vote = (sp.get("vote") as "all" | "反対" | "賛成") ?? "all";
    const issueType = sp.get("issueType") ?? "all";
    const result = queryBoundary(investorId, metric, vote, issueType, format === "csv" ? CSV_MAX_ROWS : 300);
    if (format === "csv") return recordsToCsv(result.rows.map((row) => row.record), investorId);
    return Response.json(result);
  }

  return Response.json({ error: `unknown mode: ${mode}` }, { status: 400 });
}
