// 論点ラベル定義（純粋な定数のみ）。
// client component からも import されるため、fs 依存のある lib/data や
// lib/inference をここに import しないこと。
import type { IssueType } from "@/lib/types";

export const issueLabels: Record<IssueType, string> = {
  board_independence: "取締役会の独立性",
  outside_director_ratio: "独立社外取締役比率",
  outside_director_independence: "社外取締役の独立性",
  gender_diversity: "女性取締役・女性役員",
  board_chair_independence: "取締役会議長の独立性",
  tenure: "社外取締役の在任期間",
  overboarding: "兼職数",
  attendance: "取締役会・委員会出席率",
  independence_failure: "独立性欠如",
  low_roe: "ROE基準",
  low_tsr: "TSR基準",
  low_pbr: "PBR基準",
  policy_shareholdings: "政策保有株式",
  compensation: "役員報酬・株式報酬",
  takeover_defense: "買収防衛策・ポイズンピル",
  shareholder_proposal: "株主提案への賛否判断",
};

export const issueTaxonomy: { category: string; issue: string; issue_type: IssueType }[] = [
  { category: "取締役会構成", issue: "取締役会の独立性", issue_type: "board_independence" },
  { category: "取締役会構成", issue: "独立社外取締役比率", issue_type: "outside_director_ratio" },
  { category: "取締役会構成", issue: "社外取締役の独立性", issue_type: "outside_director_independence" },
  { category: "取締役会構成", issue: "女性取締役・女性役員", issue_type: "gender_diversity" },
  { category: "取締役会構成", issue: "取締役会議長の独立性", issue_type: "board_chair_independence" },
  { category: "個別取締役", issue: "社外取締役の在任期間", issue_type: "tenure" },
  { category: "個別取締役", issue: "兼職数", issue_type: "overboarding" },
  { category: "個別取締役", issue: "取締役会・委員会出席率", issue_type: "attendance" },
  { category: "個別取締役", issue: "独立性欠如", issue_type: "independence_failure" },
  { category: "業績・資本効率", issue: "ROE基準", issue_type: "low_roe" },
  { category: "業績・株価", issue: "TSR基準", issue_type: "low_tsr" },
  { category: "市場評価", issue: "PBR基準", issue_type: "low_pbr" },
  { category: "資本政策", issue: "政策保有株式", issue_type: "policy_shareholdings" },
  { category: "報酬", issue: "役員報酬・株式報酬", issue_type: "compensation" },
  { category: "買収防衛策", issue: "買収防衛策・ポイズンピル", issue_type: "takeover_defense" },
  { category: "株主提案", issue: "株主提案への賛否判断", issue_type: "shareholder_proposal" },
];
