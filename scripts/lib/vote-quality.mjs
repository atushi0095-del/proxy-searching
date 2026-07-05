// 議決権行使結果レコードの数値信頼性チェック。
// 一部の会社は「複数候補者の得票数が1セルに連結される」特殊なテーブル形式を使っており、
// その場合 votes_for/against の桁が壊れる（実在しえない桁数になる、または
// 報告された賛成率と実際の得票数が大きく矛盾する）。
// このチェックに引っかかったレコードは数値が信頼できないため、
// 抽出時・既存データ補修時・UI表示時のすべてで同じ基準を使う。

// 東証全上場企業の発行済株式総数を大きく超える水準（実在しえない議決権数）
export const MAX_PLAUSIBLE_VOTES = 5_000_000_000;
export const DEFAULT_PCT_TOLERANCE = 15;

export function isHugeNumber(n) {
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) > MAX_PLAUSIBLE_VOTES;
}

export function computedApprovalPct(record) {
  const { votes_for, votes_against, votes_abstain } = record;
  if (votes_for === null || votes_against === null) return null;
  const total = votes_for + votes_against + (votes_abstain ?? 0);
  if (total <= 0) return null;
  return Math.round((votes_for / total) * 10000) / 100;
}

/**
 * 一部の会社（例: オムロン）は「決議の結果及び賛成（反対）割合」列に
 * 実際には反対割合を記載している。報告値と計算値(賛成ベース)が食い違っても
 * 「100−報告値」が計算値と一致するなら、報告値は反対割合だったと判定できる。
 */
export function isComplementMismatch(reportedPct, computedForPct, pctTolerance = DEFAULT_PCT_TOLERANCE) {
  if (reportedPct === null || computedForPct === null) return false;
  return Math.abs(computedForPct - reportedPct) > pctTolerance && Math.abs(computedForPct - (100 - reportedPct)) <= 1;
}

/**
 * レコードの approval_pct を検証・補正する。
 * 反対割合との取り違えが検出できれば賛成率を計算値で補正し、
 * それでも計算値と乖離する場合は得票数自体が信頼できないと判定する。
 */
export function resolveRecord(record, pctTolerance = DEFAULT_PCT_TOLERANCE) {
  if (isHugeNumber(record.votes_for) || isHugeNumber(record.votes_against) || isHugeNumber(record.votes_abstain)) {
    return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "suspect" };
  }

  // 得票数が候補者名の位置に流れ込むレイアウトずれ（例: candidate_name="166,778"）
  if (record.candidate_name && /^[\d,，.\s]+$/.test(record.candidate_name)) {
    return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "suspect" };
  }

  // 脚注をタイトルとして拾った行（例: 「第1号議案（数字は候補者番号）」）は
  // 候補者番号を得票数と誤読しているため信頼できない
  if (/[（(]\s*数字は候補者番号/.test(String(record.proposal_title ?? ""))) {
    return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "suspect" };
  }

  // 賛成が2個以下は誤読とみなす（株主提案の提出には300個以上の議決権が必要で、
  // 提案株主自身が賛成に回るため、正規の議案で賛成≤2はどの単位系でも実在しえない）
  if (record.votes_for !== null && record.votes_for <= 2 && (record.votes_against ?? 0) > 100) {
    return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "suspect" };
  }

  const computed = computedApprovalPct(record);
  if (record.approval_pct === null || computed === null) {
    return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "ok" };
  }

  if (Math.abs(computed - record.approval_pct) <= pctTolerance) {
    return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "ok" };
  }

  if (isComplementMismatch(record.approval_pct, computed, pctTolerance)) {
    return { approval_pct: computed, approval_pct_source: "corrected_complement", data_quality: "ok" };
  }

  return { approval_pct: record.approval_pct, approval_pct_source: record.approval_pct_source, data_quality: "suspect" };
}

/** レコードの得票数・賛成率が信頼できるかを判定する（後方互換用） */
export function isSuspectRecord(record, pctTolerance = DEFAULT_PCT_TOLERANCE) {
  return resolveRecord(record, pctTolerance).data_quality === "suspect";
}
