import investorsRaw from "@/data/investors.json";
import guidelineRulesRaw from "@/data/guideline_rules.json";
import companiesRaw from "@/data/companies.json";
import financialMetricsRaw from "@/data/financial_metrics.json";
import directorsRaw from "@/data/directors.json";
import directorRoleHistoryRaw from "@/data/director_role_history.json";
import governanceMetricsRaw from "@/data/company_governance_metrics.json";
import guidelineSourcesRaw from "@/data/guideline_sources.json";
import voteResultsRaw from "@/data/vote_results.json";

import type {
  Company,
  CompanyGovernanceMetric,
  Director,
  FinancialMetric,
  GuidelineRule,
  GuidelineSource,
  Investor,
  VoteResult,
} from "@/lib/types";

export const investors = investorsRaw as Investor[];
export const guidelineRules = guidelineRulesRaw as GuidelineRule[];
export const companies = companiesRaw as Company[];
export const financialMetrics = financialMetricsRaw as FinancialMetric[];
export const directors = directorsRaw as Director[];
export const directorRoleHistory = directorRoleHistoryRaw;
export const companyGovernanceMetrics = governanceMetricsRaw as CompanyGovernanceMetric[];
export const guidelineSources = guidelineSourcesRaw as GuidelineSource[];
export const voteResults = voteResultsRaw as VoteResult[];

export function getInvestor(id: string): Investor | undefined {
  return investors.find((investor) => investor.investor_id === id);
}

export function getCompany(code: string): Company | undefined {
  return companies.find((company) => company.company_code === code);
}

export function getFinancialMetrics(companyCode: string): FinancialMetric[] {
  return financialMetrics
    .filter((metric) => metric.company_code === companyCode)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

export function getDirectors(companyCode: string, meetingYear: number): Director[] {
  return directors.filter(
    (director) =>
      director.company_code === companyCode &&
      director.meeting_year === meetingYear
  );
}

export function getCompanyGovernanceMetric(
  companyCode: string,
  meetingYear: number
): CompanyGovernanceMetric | undefined {
  return companyGovernanceMetrics.find(
    (metric) =>
      metric.company_code === companyCode && metric.meeting_year === meetingYear
  );
}

export function getGuidelineRules(investorId: string): GuidelineRule[] {
  return guidelineRules.filter((rule) => rule.investor_id === investorId);
}

export function getGuidelineSources(
  investorId: string,
  documentType?: GuidelineSource["document_type"]
): GuidelineSource[] {
  return guidelineSources
    .filter(
      (source) =>
        source.investor_id === investorId &&
        (documentType === undefined || source.document_type === documentType)
    )
    .sort((a, b) => b.year - a.year);
}

export function getVoteResults(investorId: string): VoteResult[] {
  return voteResults.filter((result) => result.investor_id === investorId);
}
