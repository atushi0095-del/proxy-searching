// 投資家別行使結果の分析クエリ層（サーバー専用）。
// SQLite（scripts/build-analysis-db.mjs が生成）でフィルタし、
// 財務・役員条件は絞り込み後の行に対して適用する。
// ブラウザへは表示分（最大300行）だけを返す。
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// path.join は "data" サブフォルダに静的スコープする（Turbopack がプロジェクト全体を
// ビルド成果物にトレースしてしまうのを防ぐため）
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "generated", "analysis.db");

export interface AnalysisRecord {
  id: number;
  investor_id: string;
  company_code: string;
  company_name: string;
  meeting_date: string;
  meeting_year: number;
  proposal_number: string;
  resolution_number: string | null;
  candidate_number: string | null;
  proposal_type: string;
  proposal_title_normalized: string | null;
  director_or_role: string;
  vote: string;
  issue_type: string;
  detail_tags: string[];
  target_label: string | null;
  match_method: string | null;
  target_confidence: string | null;
  matched_director_name: string | null;
  matched_director_title: string | null;
  matched_director_attributes: string[];
  director_match_method: string | null;
  director_match_confidence: string | null;
  reason: string;
  source_url: string;
  source_title: string;
  convocation_notice_url: string | null;
}

interface RawRow {
  [key: string]: unknown;
}

export interface DirectorRef {
  director_id?: string;
  company_code: string;
  meeting_year: number;
  name: string;
  current_title: string;
  is_inside_director?: boolean;
  is_outside_director?: boolean;
  is_independent?: boolean;
  is_president?: boolean;
  is_ceo?: boolean;
  is_chair?: boolean;
  has_representative_authority?: boolean;
  is_board_chair?: boolean;
  tenure_years_before_meeting?: number;
  tenure_years_after_reelection?: number;
  board_attendance_rate?: number | null;
  outside_board_seats?: number;
  listed_company_board_seats?: number;
  is_female?: boolean;
}

interface RoleHistoryRef {
  company_code: string;
  name: string;
  role_type: string;
  role_title: string;
  start_year: number;
  end_year: number | null;
  has_representative_authority: boolean;
}

interface FinancialRef {
  company_code: string;
  fiscal_year: number;
  roe: number | null;
  pbr: number | null;
  tsr_3y_rank_percentile?: number | null;
  source_url: string;
  notes: string;
}

interface GovernanceRef {
  company_code: string;
  meeting_year: number;
  independent_director_ratio: number;
  female_director_ratio: number;
  policy_shareholdings_ratio: number | null;
  source_url: string;
  notes: string;
}

export type MetricKey =
  | "none"
  | "roe"
  | "pbr"
  | "tsr_3y_rank_percentile"
  | "policy_shareholdings_ratio"
  | "independent_director_ratio"
  | "female_director_ratio"
  | "tenure_before"
  | "tenure_after"
  | "board_attendance_rate"
  | "outside_board_seats"
  | "listed_company_board_seats";

export type Operator = "none" | "below" | "below_or_equal" | "above" | "above_or_equal";

export interface MetricValue {
  label: string;
  value: number | null;
  sourceUrl: string;
  notes: string;
}

interface ReferenceData {
  directorsByCompany: Map<string, DirectorRef[]>;
  historyByCompany: Map<string, RoleHistoryRef[]>;
  financialByCompany: Map<string, FinancialRef[]>;
  governanceByCompany: Map<string, GovernanceRef[]>;
}

// dev の HMR でモジュールが再評価されても接続・参照データを使い回す
const globalCache = globalThis as unknown as {
  __analysisDb?: DatabaseSync;
  __analysisRefData?: ReferenceData;
};

export function getDb(): DatabaseSync | null {
  if (globalCache.__analysisDb) return globalCache.__analysisDb;
  if (!existsSync(DB_PATH)) return null;
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  globalCache.__analysisDb = db;
  return db;
}

function groupByCompany<T extends { company_code: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.company_code);
    if (list) list.push(item);
    else map.set(item.company_code, [item]);
  }
  return map;
}

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, fileName), "utf8")) as T;
}

export function getReferenceData(): ReferenceData {
  if (globalCache.__analysisRefData) return globalCache.__analysisRefData;
  const data: ReferenceData = {
    directorsByCompany: groupByCompany(readJson<DirectorRef[]>("directors.json")),
    historyByCompany: groupByCompany(readJson<RoleHistoryRef[]>("director_role_history.json")),
    financialByCompany: groupByCompany(readJson<FinancialRef[]>("financial_metrics.json")),
    governanceByCompany: groupByCompany(readJson<GovernanceRef[]>("company_governance_metrics.json")),
  };
  globalCache.__analysisRefData = data;
  return data;
}

export function rowToRecord(row: RawRow): AnalysisRecord {
  return {
    ...(row as unknown as AnalysisRecord),
    id: Number(row.id),
    meeting_year: Number(row.meeting_year),
    detail_tags: row.detail_tags ? (JSON.parse(String(row.detail_tags)) as string[]) : [],
    matched_director_attributes: row.matched_director_attributes
      ? (JSON.parse(String(row.matched_director_attributes)) as string[])
      : [],
  };
}

// ---- 条件評価（クライアントの InvestorAnalysisWorkspace から移植） ----

export function directorMatchesRole(director: DirectorRef, roleCondition: string): boolean {
  if (roleCondition === "all") return true;
  if (roleCondition === "current_president_or_ceo") return Boolean(director.is_president || director.is_ceo);
  if (roleCondition === "current_representative_chair") return Boolean(director.is_chair && director.has_representative_authority);
  if (roleCondition === "current_board_chair") return Boolean(director.is_board_chair);
  if (roleCondition === "current_inside_director") return Boolean(director.is_inside_director);
  if (roleCondition === "current_outside_director") return Boolean(director.is_outside_director);
  if (roleCondition === "current_independent_outside_director") return Boolean(director.is_outside_director && director.is_independent);
  if (roleCondition === "current_female_director") return Boolean(director.is_female);
  if (roleCondition === "current_female_outside_director") return Boolean(director.is_female && director.is_outside_director);
  return false;
}

function historyMatchesRole(history: RoleHistoryRef, roleCondition: string, year: number): boolean {
  const endYear = history.end_year ?? year;
  const activeWithin3Years = history.start_year <= year && endYear >= year - 3;
  if (!activeWithin3Years) return false;
  if (roleCondition === "former_president_within_3_years") return history.role_type === "president" || history.role_type === "ceo";
  if (roleCondition === "former_representative_chair_within_3_years") return history.role_type === "chair" && history.has_representative_authority;
  return false;
}

function companyDirectors(ref: ReferenceData, companyCode: string, year: number): DirectorRef[] {
  return (ref.directorsByCompany.get(companyCode) ?? []).filter((d) => d.meeting_year <= year);
}

export function companyMatchesRole(ref: ReferenceData, companyCode: string, year: number, roleCondition: string): boolean {
  if (roleCondition === "all") return true;
  const directors = ref.directorsByCompany.get(companyCode) ?? [];
  const history = ref.historyByCompany.get(companyCode) ?? [];
  // 未登録企業は条件をスキップ（登録済み企業のみ数値・役職条件を適用する既存仕様）
  if (directors.length === 0 && history.length === 0) return true;
  if (roleCondition.startsWith("former_")) {
    return history.some((item) => historyMatchesRole(item, roleCondition, year));
  }
  return directors.filter((d) => d.meeting_year <= year).some((d) => directorMatchesRole(d, roleCondition));
}

export function matchedDirectors(ref: ReferenceData, companyCode: string, year: number, roleCondition: string): DirectorRef[] {
  if (roleCondition === "all" || roleCondition.startsWith("former_")) return [];
  return companyDirectors(ref, companyCode, year).filter((d) => directorMatchesRole(d, roleCondition));
}

export function historicalRoleNames(ref: ReferenceData, companyCode: string, year: number, roleCondition: string): string[] {
  if (!roleCondition.startsWith("former_")) return [];
  return (ref.historyByCompany.get(companyCode) ?? [])
    .filter((item) => historyMatchesRole(item, roleCondition, year))
    .map((item) => `${item.name}（${item.role_title}、${item.start_year}-${item.end_year ?? "現任"}）`);
}

function recentFinancials(ref: ReferenceData, companyCode: string, year: number, periods: number): FinancialRef[] {
  return (ref.financialByCompany.get(companyCode) ?? [])
    .filter((metric) => metric.fiscal_year <= year)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
    .slice(0, periods)
    .reverse();
}

function latestGovernance(ref: ReferenceData, companyCode: string, year: number): GovernanceRef | undefined {
  return (ref.governanceByCompany.get(companyCode) ?? [])
    .filter((metric) => metric.meeting_year <= year)
    .sort((a, b) => b.meeting_year - a.meeting_year)[0];
}

export function metricValuesFor(
  ref: ReferenceData,
  companyCode: string,
  year: number,
  metricKey: MetricKey,
  periods: number
): MetricValue[] {
  if (metricKey === "none") return [];
  if (metricKey === "roe" || metricKey === "pbr" || metricKey === "tsr_3y_rank_percentile") {
    return recentFinancials(ref, companyCode, year, periods).map((metric) => ({
      label: String(metric.fiscal_year),
      value: metric[metricKey] ?? null,
      sourceUrl: metric.source_url,
      notes: metric.notes,
    }));
  }
  if (metricKey === "policy_shareholdings_ratio" || metricKey === "independent_director_ratio" || metricKey === "female_director_ratio") {
    const metric = latestGovernance(ref, companyCode, year);
    return metric
      ? [{ label: String(metric.meeting_year), value: metric[metricKey] ?? null, sourceUrl: metric.source_url, notes: metric.notes }]
      : [];
  }
  return companyDirectors(ref, companyCode, year).map((director) => {
    const valueMap: Record<string, number | null | undefined> = {
      tenure_before: director.tenure_years_before_meeting,
      tenure_after: director.tenure_years_after_reelection,
      board_attendance_rate: director.board_attendance_rate,
      outside_board_seats: director.outside_board_seats,
      listed_company_board_seats: director.listed_company_board_seats,
    };
    return {
      label: director.name,
      value: valueMap[metricKey] ?? null,
      sourceUrl: "",
      notes: director.current_title,
    };
  });
}

function compareValue(value: number | null | undefined, operator: Operator, thresholdText: string): boolean {
  if (operator === "none" || thresholdText.trim() === "") return true;
  if (value === null || value === undefined || Number.isNaN(value)) return false;
  const threshold = Number(thresholdText);
  if (!Number.isFinite(threshold)) return true;
  if (operator === "below") return value < threshold;
  if (operator === "below_or_equal") return value <= threshold;
  if (operator === "above") return value > threshold;
  if (operator === "above_or_equal") return value >= threshold;
  return true;
}

export function metricConditionMatches(
  ref: ReferenceData,
  companyCode: string,
  year: number,
  metricKey: MetricKey,
  operator: Operator,
  threshold: string,
  periodsText: string
): boolean {
  if (metricKey === "none" || operator === "none") return true;
  const periods = Math.max(1, Number(periodsText) || 1);
  const values = metricValuesFor(ref, companyCode, year, metricKey, periods);
  if (values.length === 0) return true;
  if (metricKey === "roe" || metricKey === "pbr" || metricKey === "tsr_3y_rank_percentile") {
    return values.length >= periods && values.every((item) => compareValue(item.value, operator, threshold));
  }
  return values.some((item) => compareValue(item.value, operator, threshold));
}

// ---- クエリ ----

export interface InvestorFacets {
  issueTypes: string[];
  detailTags: string[];
  meetingYears: string[];
  summary: { total: number; againstCount: number; forCount: number; forWithReasonCount: number };
}

export function getInvestorFacets(investorId: string): InvestorFacets {
  const db = getDb();
  if (!db) return { issueTypes: [], detailTags: [], meetingYears: [], summary: { total: 0, againstCount: 0, forCount: 0, forWithReasonCount: 0 } };
  const facets = db.prepare("SELECT facet, value FROM investor_facets WHERE investor_id = ?").all(investorId) as { facet: string; value: string }[];
  const summaryRow = db.prepare("SELECT * FROM investor_summary WHERE investor_id = ?").get(investorId) as
    | { total: number; against_count: number; for_count: number; for_with_reason_count: number }
    | undefined;
  return {
    issueTypes: facets.filter((f) => f.facet === "issue_type").map((f) => f.value),
    detailTags: facets.filter((f) => f.facet === "detail_tag").map((f) => f.value),
    meetingYears: facets.filter((f) => f.facet === "meeting_year").map((f) => f.value),
    summary: {
      total: summaryRow?.total ?? 0,
      againstCount: summaryRow?.against_count ?? 0,
      forCount: summaryRow?.for_count ?? 0,
      forWithReasonCount: summaryRow?.for_with_reason_count ?? 0,
    },
  };
}

export interface ListFilter {
  year: string; // "latest" | "all" | "2025" など
  vote: "all" | "against" | "for";
  issueType: string;
  detailTag: string;
  reason: "all" | "with" | "without";
  sort: "default" | "company" | "meeting_date_desc" | "reason";
  preset: "none" | "low_roe_director_elections";
  query: string;
  limit: number;
}

export interface ListResult {
  rows: AnalysisRecord[];
  totalFiltered: number;
  filteredAgainst: number;
  filteredFor: number;
  filteredCompanies: number;
  latestYear: string;
}

function keywordClause(query: string, params: string[]): string {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  // スペース区切りは OR 検索（既存仕様）
  const parts = words.map(() => "instr(search_text, ?) > 0");
  for (const word of words) params.push(word);
  return ` AND (${parts.join(" OR ")})`;
}

export function queryList(investorId: string, filter: ListFilter): ListResult {
  const db = getDb();
  const facets = getInvestorFacets(investorId);
  const latestYear = facets.meetingYears[0] ?? "all";
  if (!db) return { rows: [], totalFiltered: 0, filteredAgainst: 0, filteredFor: 0, filteredCompanies: 0, latestYear };

  const params: (string | number)[] = [investorId];
  let where = "investor_id = ?";

  const effectiveYear = filter.year === "latest" ? latestYear : filter.year;
  if (effectiveYear !== "all") {
    where += " AND meeting_year = ?";
    params.push(Number(effectiveYear));
  }
  if (filter.vote === "against") where += " AND is_against = 1";
  if (filter.vote === "for") where += " AND vote = '賛成'";
  if (filter.preset === "low_roe_director_elections") {
    where +=
      " AND is_director_election = 1 AND EXISTS (SELECT 1 FROM vote_records lr WHERE lr.investor_id = vote_records.investor_id AND lr.company_code = vote_records.company_code AND lr.meeting_year = vote_records.meeting_year AND lr.issue_type = 'low_roe' AND lr.is_against = 1)";
  } else if (filter.issueType !== "all") {
    where += " AND issue_type = ?";
    params.push(filter.issueType);
  }
  if (filter.detailTag !== "all") {
    where += " AND detail_tags IS NOT NULL AND instr(detail_tags, ?) > 0";
    params.push(JSON.stringify(filter.detailTag).slice(1, -1));
  }
  if (filter.reason === "with") where += " AND has_reason = 1";
  if (filter.reason === "without") where += " AND has_reason = 0";
  const keywordParams: string[] = [];
  where += keywordClause(filter.query, keywordParams);
  params.push(...keywordParams);

  const orderBy =
    filter.sort === "company"
      ? "company_code ASC, meeting_date DESC"
      : filter.sort === "meeting_date_desc"
        ? "meeting_date DESC, company_code ASC"
        : filter.sort === "reason"
          ? "has_reason DESC, company_code ASC, meeting_date DESC"
          : "id ASC";

  const agg = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_against = 1 AND vote != '賛成' THEN 1 ELSE 0 END) AS against_count,
              SUM(CASE WHEN vote = '賛成' THEN 1 ELSE 0 END) AS for_count,
              COUNT(DISTINCT company_code) AS company_count
       FROM vote_records WHERE ${where}`
    )
    .get(...params) as { total: number; against_count: number | null; for_count: number | null; company_count: number };
  const rows = (
    db.prepare(`SELECT * FROM vote_records WHERE ${where} ORDER BY ${orderBy} LIMIT ?`).all(...params, filter.limit) as RawRow[]
  ).map(rowToRecord);

  return {
    rows,
    totalFiltered: agg.total,
    filteredAgainst: agg.against_count ?? 0,
    filteredFor: agg.for_count ?? 0,
    filteredCompanies: agg.company_count,
    latestYear,
  };
}

export interface ConditionFilter {
  vote: "all" | "反対" | "賛成";
  issueType: string;
  detailTag: string;
  roleCondition: string;
  keyword: string;
  metricKey: MetricKey;
  metricOperator: Operator;
  metricThreshold: string;
  metricPeriods: string;
  expandCompanies: boolean;
  limit: number;
}

export interface ConditionRowExtra {
  metric_values: MetricValue[];
  matched_directors: { name: string; title: string; director: DirectorRef }[];
  historical_names: string[];
  is_direct_match: boolean;
}

export interface ConditionResult {
  rows: (AnalysisRecord & ConditionRowExtra)[];
  totalMatched: number;
  matchedAgainst: number;
  matchedFor: number;
  displayTotal: number;
  displayAgainst: number;
  displayFor: number;
  matchedCompanyCount: number;
}

export function queryConditions(investorId: string, filter: ConditionFilter): ConditionResult {
  const db = getDb();
  const empty: ConditionResult = { rows: [], totalMatched: 0, matchedAgainst: 0, matchedFor: 0, displayTotal: 0, displayAgainst: 0, displayFor: 0, matchedCompanyCount: 0 };
  if (!db) return empty;
  const ref = getReferenceData();

  const params: (string | number)[] = [investorId];
  let where = "investor_id = ?";
  if (filter.vote !== "all") {
    where += " AND vote = ?";
    params.push(filter.vote);
  }
  if (filter.issueType !== "all") {
    where += " AND issue_type = ?";
    params.push(filter.issueType);
  }
  if (filter.detailTag !== "all") {
    where += " AND detail_tags IS NOT NULL AND instr(detail_tags, ?) > 0";
    params.push(JSON.stringify(filter.detailTag).slice(1, -1));
  }
  const keywordParams: string[] = [];
  where += keywordClause(filter.keyword, keywordParams);
  params.push(...keywordParams);

  // SQL で絞った行に対して役職・数値条件を JS で適用（企業単位でキャッシュ）
  const candidates = (db.prepare(`SELECT * FROM vote_records WHERE ${where} ORDER BY id ASC`).all(...params) as RawRow[]).map(rowToRecord);
  const conditionCache = new Map<string, boolean>();
  const matched: AnalysisRecord[] = [];
  for (const record of candidates) {
    const key = `${record.company_code}:${record.meeting_year}`;
    let ok = conditionCache.get(key);
    if (ok === undefined) {
      ok =
        companyMatchesRole(ref, record.company_code, record.meeting_year, filter.roleCondition) &&
        metricConditionMatches(ref, record.company_code, record.meeting_year, filter.metricKey, filter.metricOperator, filter.metricThreshold, filter.metricPeriods);
      conditionCache.set(key, ok);
    }
    if (ok) matched.push(record);
  }

  const matchedKeys = new Set(matched.map((r) => `${r.company_code}:${r.meeting_year}`));
  const directMatchIds = new Set(matched.map((r) => r.id));

  let displayRows: AnalysisRecord[];
  if (filter.expandCompanies && matchedKeys.size > 0) {
    // 条件該当企業×総会年の全議案を展開（賛否問わず）
    displayRows = candidatesForCompanies(db, investorId, matchedKeys);
  } else {
    displayRows = matched;
  }

  const limited = displayRows.slice(0, filter.limit);
  const rows = limited.map((record) => ({
    ...record,
    metric_values: metricValuesFor(ref, record.company_code, record.meeting_year, filter.metricKey, Math.max(1, Number(filter.metricPeriods) || 1)),
    matched_directors: matchedDirectors(ref, record.company_code, record.meeting_year, filter.roleCondition).map((director) => ({
      name: director.name,
      title: director.current_title,
      director,
    })),
    historical_names: historicalRoleNames(ref, record.company_code, record.meeting_year, filter.roleCondition),
    is_direct_match: directMatchIds.has(record.id),
  }));

  return {
    rows,
    totalMatched: matched.length,
    matchedAgainst: matched.filter((r) => r.vote === "反対").length,
    matchedFor: matched.filter((r) => r.vote === "賛成").length,
    displayTotal: displayRows.length,
    displayAgainst: displayRows.filter((r) => r.vote === "反対").length,
    displayFor: displayRows.filter((r) => r.vote === "賛成").length,
    matchedCompanyCount: matchedKeys.size,
  };
}

function candidatesForCompanies(db: DatabaseSync, investorId: string, keys: Set<string>): AnalysisRecord[] {
  // (company_code, meeting_year) ペアの一時テーブル代わりに IN 句をチャンク分割
  const pairs = [...keys].map((key) => key.split(":"));
  const results: AnalysisRecord[] = [];
  const CHUNK = 400;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);
    const clause = chunk.map(() => "(company_code = ? AND meeting_year = ?)").join(" OR ");
    const params: (string | number)[] = [investorId];
    for (const [code, year] of chunk) params.push(code, Number(year));
    const rows = db.prepare(`SELECT * FROM vote_records WHERE investor_id = ? AND (${clause}) ORDER BY id ASC`).all(...params) as RawRow[];
    results.push(...rows.map(rowToRecord));
  }
  return results;
}

export interface BoundaryResult {
  rows: { record: AnalysisRecord; values: MetricValue[] }[];
  total: number;
}

export function queryBoundary(
  investorId: string,
  metric: MetricKey,
  vote: "all" | "反対" | "賛成",
  issueType: string,
  limit: number
): BoundaryResult {
  const db = getDb();
  if (!db) return { rows: [], total: 0 };
  const ref = getReferenceData();

  const params: (string | number)[] = [investorId];
  let where = "investor_id = ?";
  if (vote !== "all") {
    where += " AND vote = ?";
    params.push(vote);
  }
  if (issueType !== "all") {
    where += " AND issue_type = ?";
    params.push(issueType);
  }

  // (企業, 行使, 論点, 議案種別) で重複排除して代表行を取る（既存仕様）
  const raw = db
    .prepare(
      `SELECT * FROM vote_records WHERE id IN (
         SELECT MIN(id) FROM vote_records WHERE ${where} GROUP BY company_code, vote, issue_type, proposal_type
       ) ORDER BY id ASC`
    )
    .all(...params) as RawRow[];

  const rows = raw
    .map(rowToRecord)
    .map((record) => ({
      record,
      values: metricValuesFor(ref, record.company_code, record.meeting_year, metric, metric === "roe" ? 3 : 1),
    }))
    .sort((a, b) => {
      const av = a.values.length ? Math.max(...a.values.map((item) => item.value ?? Number.NEGATIVE_INFINITY)) : Number.NEGATIVE_INFINITY;
      const bv = b.values.length ? Math.max(...b.values.map((item) => item.value ?? Number.NEGATIVE_INFINITY)) : Number.NEGATIVE_INFINITY;
      return av - bv || a.record.company_code.localeCompare(b.record.company_code);
    });

  return { rows: rows.slice(0, limit), total: rows.length };
}
