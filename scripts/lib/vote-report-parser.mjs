// 臨時報告書（議決権行使結果）HTML のパース関数群。
// edinet-extract-vote-results.mjs から利用。純粋関数のみでテスト可能。
import { resolveRecord } from "./vote-quality.mjs";

// ── HTML テーブルパース ──────────────────────────────
export function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** 全角数字→半角（EDINET本文は「２０２５年６月」など全角が多い） */
export function zenkakuDigitsToHankaku(text) {
  return String(text).replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

export function cellText(html) {
  return zenkakuDigitsToHankaku(decodeEntities(html.replace(/<[^>]*>/g, " ")))
    .replace(/[\s　]+/g, " ")
    .trim();
}

/** HTML から全テーブルを [ [cell, ...], ... ] の配列として抽出 */
export function parseTables(html) {
  const tables = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const rows = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableMatch[0])) !== null) {
      const cells = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cMatch;
      while ((cMatch = cellRe.exec(rowMatch[0])) !== null) {
        cells.push(cellText(cMatch[1]));
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

export function parseVoteCount(text) {
  const cleaned = String(text ?? "").replace(/[,，]/g, "").replace(/[\s　]/g, "");
  const m = cleaned.match(/^(\d+)(?:個|千個)?$/);
  if (!m) return null;
  return Number(m[1]);
}

export function parseApprovalPct(text) {
  const s = String(text ?? "");
  const m = s.match(/([\d]+(?:\.[\d]+)?)\s*[%％]/);
  if (m) return Number(m[1]);
  // 「可決 97.32」形式（％は表ヘッダーに記載されるため本文に付かない会社が多い）
  const m2 = s.match(/(?:可決|否決|承認)[^\d]*([\d]+(?:\.[\d]+)?)/);
  if (m2) return Number(m2[1]);
  return null;
}

/** 議案タイトルから種別を分類 */
export function classifyProposal(title) {
  const t = String(title ?? "");
  if (/剰余金|配当/.test(t)) return "剰余金処分";
  if (/定款/.test(t)) return "定款変更";
  if (/監査等委員.*取締役|監査等委員である取締役/.test(t)) return "取締役選任(監査等委員)";
  if (/取締役.*選任|取締役.*選解任/.test(t)) return "取締役選任";
  if (/監査役.*選任/.test(t)) return "監査役選任";
  if (/会計監査人/.test(t)) return "会計監査人選任";
  if (/報酬|賞与|ストック・?オプション|株式付与/.test(t)) return "役員報酬";
  if (/退職慰労/.test(t)) return "退職慰労金";
  if (/買収防衛|対応方針/.test(t)) return "買収防衛策";
  if (/合併|株式交換|株式移転|会社分割|事業譲渡/.test(t)) return "組織再編";
  if (/株主提案/.test(t)) return "株主提案";
  return "その他";
}

/** 氏名正規化: 空白（全角含む）除去。年次比較の名寄せキー */
export function normalizeName(name) {
  return String(name ?? "").replace(/[\s　]/g, "");
}

/** 総会開催日を本文から抽出 */
export function extractMeetingDate(text) {
  const m = text.match(/株主総会(?:が開催された年月日|の開催年月日)[^\d]{0,80}?(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  const m2 = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(?:開催の)?(?:定時|臨時)株主総会/);
  if (m2) return `${m2[1]}-${String(m2[2]).padStart(2, "0")}-${String(m2[3]).padStart(2, "0")}`;
  return null;
}

export const PROPOSAL_RE = /第\s*([0-9０-９]+)\s*号議案/;

export function zenToHan(text) {
  return String(text).replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 議決権行使結果テーブルをレコード配列へ変換。
 * 行パターン:
 *   議案行（数値あり）    : [第1号議案 剰余金処分の件, 179157, 1229, 25, (注)1, 可決 97.32%]
 *   議案見出し行（数値なし）: [第2号議案 取締役12名選任の件]
 *   候補者行             : [牧野明次, 155300, 25086, 25, (注)2, 可決 84.36%]
 */
export function extractRecordsFromTable(rows) {
  const records = [];
  let currentProposalNo = null;
  let currentProposalTitle = null;

  // ヘッダー行判定: 賛成・反対を含む行
  const headerIdx = rows.findIndex((cells) => {
    const joined = cells.join(" ");
    return /賛成/.test(joined) && /反対/.test(joined);
  });
  if (headerIdx < 0) return records;

  for (const cells of rows.slice(headerIdx + 1)) {
    const first = cells[0] ?? "";
    if (!first || /^(注|※|合計|決議事項)/.test(first)) continue;

    const proposalMatch = first.match(PROPOSAL_RE);
    // 数値セルの抽出（賛成・反対・棄権の順が標準）
    const numbers = [];
    let pct = null;
    let result = null;
    for (const cell of cells.slice(1)) {
      const n = parseVoteCount(cell);
      if (n !== null && numbers.length < 3) numbers.push(n);
      const p = parseApprovalPct(cell);
      if (p !== null) pct = p;
      if (/可決|否決|承認/.test(cell)) result = /否決/.test(cell) ? "否決" : "可決";
    }

    if (proposalMatch) {
      currentProposalNo = Number(zenToHan(proposalMatch[1]));
      currentProposalTitle = first.replace(/[\s　]+/g, "");
      if (numbers.length >= 2) {
        // 議案行に直接数値がある（選任以外の議案）
        records.push(makeRecord(currentProposalNo, currentProposalTitle, null, numbers, pct, result));
      }
      continue;
    }

    // 候補者行: 議案コンテキストがあり数値を持つ行
    if (currentProposalNo !== null && numbers.length >= 2) {
      const candidate = normalizeName(first);
      // 数字だけ（カンマ・ピリオド含む）・長文（説明文）は候補者名ではない
      // （得票数が候補者名の列に流れ込むレイアウトずれ対策）
      if (!candidate || /^[\d,，.]+$/.test(candidate) || candidate.length > 20) continue;
      records.push(makeRecord(currentProposalNo, currentProposalTitle, candidate, numbers, pct, result));
    }
  }
  return records;
}

export function makeRecord(no, title, candidate, numbers, pct, result) {
  const [votesFor = null, votesAgainst = null, votesAbstain = null] = numbers;
  let approvalPct = pct;
  let pctSource = "reported";
  if (approvalPct === null && votesFor !== null && votesAgainst !== null) {
    const total = votesFor + votesAgainst + (votesAbstain ?? 0);
    if (total > 0) {
      approvalPct = Math.round((votesFor / total) * 10000) / 100;
      pctSource = "computed";
    }
  }
  const record = {
    proposal_no: no,
    proposal_title: title,
    proposal_category: classifyProposal(title),
    candidate_name: candidate,
    votes_for: votesFor,
    votes_against: votesAgainst,
    votes_abstain: votesAbstain,
    approval_pct: approvalPct,
    approval_pct_source: pctSource,
    result,
  };
  // 一部の会社は「賛成（反対）割合」列に実際は反対割合を記載しており、
  // また別の会社は複数候補者の得票数が1セルに連結され桁が壊れる。
  // resolveRecord がその2パターンを検出・補正し、信頼できない数値には suspect を立てる。
  const resolved = resolveRecord(record);
  record.approval_pct = resolved.approval_pct;
  record.approval_pct_source = resolved.approval_pct_source;
  record.data_quality = resolved.data_quality;
  return record;
}

