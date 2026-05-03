import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const SUMMARY_FILE = path.join(ROOT, "data", "generated", "blackrock_vote_summary.json");
const CASES_FILE = path.join(ROOT, "data", "generated", "blackrock_vote_cases.json");
const TEXT_SAMPLES_FILE = path.join(ROOT, "data", "generated", "blackrock_vote_text_samples.json");

const ISSUE_PATTERNS = [
  ["takeover_defense", ["買収防衛", "ポイズンピル"]],
  ["shareholder_proposal", ["株主提出", "株主提案"]],
  ["policy_shareholdings", ["政策保有", "保有株式"]],
  ["low_roe", ["ROE", "業績不振", "資本効率", "経営責任者", "株主資本"]],
  ["low_pbr", ["PBR"]],
  ["low_tsr", ["TSR", "株価"]],
  ["board_independence", ["独立した社外取締役", "独立な社外取締役", "経営監視", "取締役会"]],
  ["independence_failure", ["独立と認められない", "独立性"]],
  ["gender_diversity", ["女性", "ジェンダー", "多様性"]],
  ["attendance", ["出席"]],
  ["overboarding", ["兼任", "兼職"]],
  ["compensation", ["報酬", "賞与", "退職慰労金", "ストックオプション"]],
  ["tenure", ["在任", "任期", "12年"]],
];

function text(value) {
  return String(value ?? "").trim();
}

function compact(value) {
  return text(value)
    .replace(/\s+/g, "")
    .replace(/\d+\s*\/\s*\d+ページ/g, "")
    .trim();
}

function addCount(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function classifyIssue(reason, proposalType, proposer) {
  const haystack = `${reason ?? ""} ${proposalType ?? ""} ${proposer ?? ""}`;
  if (proposer === "株主") return ["shareholder_proposal"];
  const matched = ISSUE_PATTERNS
    .filter(([, terms]) => terms.some((term) => haystack.includes(term)))
    .map(([issueType]) => issueType);
  if (matched.length > 0) return matched;
  if (proposalType.includes("買収防衛")) return ["takeover_defense"];
  if (proposalType.includes("役員報酬") || proposalType.includes("退職慰労金")) return ["compensation"];
  if (proposalType.includes("取締役") || proposalType.includes("監査役")) return ["board_independence"];
  return ["other"];
}

function columnForX(x) {
  // Actual PDF column x-coordinates (measured from text samples):
  //   company_code: ~23, company_name: ~49-130, meeting_type: ~152,
  //   meeting_date: ~175, proposer: ~195, proposal_type: ~216,
  //   proposal_number: ~287, vote: ~307 (caught by isVoteText),
  //   reason: ~320-500, other_vote: ~513+
  if (x < 48) return "company_code";
  if (x < 148) return "company_name";
  if (x < 170) return "meeting_type";
  if (x < 192) return "meeting_date";
  if (x < 212) return "proposer";
  if (x < 285) return "proposal_type";
  if (x < 315) return "proposal_number";
  if (x < 510) return "reason";
  return "other_vote";
}

function isVoteText(value) {
  return /^(賛成|反対|棄権|白紙委任)/.test(text(value));
}

function normalizeVoteAndReason(voteValue, reasonValue) {
  const rawVote = compact(voteValue);
  const rawReason = compact(reasonValue);
  const voteWords = ["白紙委任", "棄権", "反対", "賛成"];

  for (const voteWord of voteWords) {
    if (rawVote.startsWith(voteWord)) {
      const extra = rawVote.slice(voteWord.length).trim();
      const reasonPrefix = extra && !/^\d+$/.test(extra) ? extra : "";
      return {
        vote: voteWord,
        reason: `${reasonPrefix}${rawReason}`.trim(),
      };
    }
  }

  return {
    vote: rawVote || "不明",
    reason: rawReason,
  };
}

function normalizeRow(row) {
  const { vote, reason } = normalizeVoteAndReason(row.vote, row.reason);
  return {
    investor_id: "blackrock",
    source_title: row.source_title,
    source_url: row.source_url,
    source_file: row.source_file,
    page_number: row.page_number,
    company_code: compact(row.company_code),
    company_name: compact(row.company_name),
    meeting_type: compact(row.meeting_type),
    meeting_date: compact(row.meeting_date),
    proposer: compact(row.proposer),
    proposal_type: compact(row.proposal_type),
    proposal_number: compact(row.proposal_number),
    sub_proposal_number: "",
    role_text: "",
    vote,
    reason,
    other_vote_note: compact(row.other_vote),
    issue_types: classifyIssue(reason, row.proposal_type, row.proposer),
  };
}

async function extractRowsFromPdf(filePath, source) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  const rows = [];
  const textSamples = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => ({
        str: text(item.str),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }))
      .filter((item) => item.str);

    if (pageNumber <= 2) {
      textSamples.push(items.slice(0, 80).map((item) => item.str).join(" "));
    }

    const pageText = items.map((item) => item.str).join("");
    if (!pageText.includes("証券コード") || !pageText.includes("行使理由")) {
      continue;
    }

    const lines = new Map();
    for (const item of items) {
      const y = Math.round(item.y);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y).push(item);
    }

    const sortedLines = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, lineItems]) => lineItems.sort((a, b) => a.x - b.x));

    let current = null;
    let pendingReason = "";
    for (const lineItems of sortedLines) {
      const lineText = lineItems.map((item) => item.str).join("");
      if (
        !lineText ||
        lineText.includes("証券コード") ||
        lineText.includes("議決権行使結果の個別開示") ||
        /^\d+\s*\/\s*\d+ページ$/.test(lineText) ||
        lineText.includes("ページ")
      ) {
        continue;
      }

      const first = lineItems[0];
      const startsNewRow = first.x <= 45 && /^[0-9A-Z]{3,5}$/.test(first.str);

      if (startsNewRow) {
        if (current?.company_code && current?.vote) rows.push(normalizeRow(current));
        current = {
          source_title: source?.title ?? path.basename(filePath),
          source_url: source?.url ?? "",
          source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
          page_number: pageNumber,
          reason: pendingReason,
        };
        pendingReason = "";
      }

      if (!current) {
        for (const item of lineItems) {
          if (item.x >= 315 && item.x < 510) {
            pendingReason = `${pendingReason}${item.str}`;
          }
        }
        continue;
      }

      if (!startsNewRow) {
        for (const item of lineItems) {
          if (item.x >= 315 && item.x < 510) {
            current.reason = `${current.reason ?? ""}${item.str}`;
          } else if (item.x >= 510) {
            current.other_vote = `${current.other_vote ?? ""}${item.str}`;
          }
        }
        continue;
      }

      for (const item of lineItems) {
        const col = isVoteText(item.str) ? "vote" : columnForX(item.x);
        current[col] = `${current[col] ?? ""}${item.str}`;
      }
    }
    if (current?.company_code && current?.vote) rows.push(normalizeRow(current));
  }

  return { rows, text_sample: textSamples.join("\n").slice(0, 1600), pages: doc.numPages };
}

function summarize(records, profiles) {
  const byVote = {};
  const byIssueType = {};
  const byProposalType = {};
  for (const record of records) {
    addCount(byVote, record.vote);
    addCount(byProposalType, `${record.proposal_type} / ${record.vote}`);
    for (const issueType of record.issue_types) addCount(byIssueType, `${issueType} / ${record.vote}`);
  }
  return {
    investor_id: "blackrock",
    generated_at: new Date().toISOString(),
    source_format: "PDF",
    parser_status: records.length > 0
      ? "PDFから個別行使結果テーブルを抽出済み。行使理由がない行は議案分類ベースで推定論点を付与。"
      : "PDF取得済みだが個別行使結果テーブルを抽出できていません。",
    total_files: profiles.length,
    text_layer_files: profiles.filter((profile) => profile.text_length > 100).length,
    total_records: records.length,
    by_vote: byVote,
    by_issue_type: byIssueType,
    by_proposal_type: byProposalType,
  };
}

function buildCases(records) {
  const issueTypes = [...new Set(records.flatMap((record) => record.issue_types))]
    .filter((issueType) => issueType !== "other")
    .sort();
  return {
    investor_name: "BlackRock Investment",
    generated_at: new Date().toISOString(),
    parser_status: "BlackRock PDFの個別行使結果から抽出した中間データ。",
    issues: issueTypes.map((issueType) => {
      const allAgainst = records.filter((record) => record.vote === "反対" && record.issue_types.includes(issueType));
      const companyCodes = new Set(allAgainst.slice(0, 120).map((record) => record.company_code));
      const allNearbyFor = records.filter((record) => record.vote === "賛成" && companyCodes.has(record.company_code));
      return {
        issue_type: issueType,
        against_count: allAgainst.length,
        against_examples: allAgainst,
        for_comparison_count: allNearbyFor.length,
        for_comparison_examples: allNearbyFor.slice(0, 500),
        inference_hint: "BlackRockの行使理由と同一企業の賛成議案を比較し、公式文言上の抽象的な反対対象を推定するための中間データ。",
      };
    }),
  };
}

const manifest = JSON.parse(await fs.readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
async function findLocalBlackRockVotePdfs() {
  try {
    const entries = await fs.readdir(SOURCE_DIR);
    const rows = [];
    const seen = new Set();
    for (const fileName of entries.filter((name) => /blackrock/i.test(name) && /vote/i.test(name) && name.endsWith(".pdf"))) {
      const filePath = path.join(SOURCE_DIR, fileName);
      const stat = await fs.stat(filePath);
      const stableName = fileName.replace(/^\d+_/, "");
      const key = `${stableName}:${stat.size}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        file_name: fileName,
        file_path: filePath,
        title: fileName,
        url: "",
      });
    }
    return rows;
  } catch {
    return [];
  }
}

async function buildSourceList(manifestItems) {
  const byPath = new Map();
  for (const item of manifestItems) {
    if (item.investor_id !== "blackrock" || item.kind !== "vote_result" || !item.file_name?.endsWith(".pdf")) continue;
    const candidatePath = item.file_path ? path.resolve(ROOT, item.file_path) : path.join(SOURCE_DIR, item.file_name);
    try {
      await fs.access(candidatePath);
      byPath.set(candidatePath, { ...item, file_path: candidatePath });
    } catch {
      // Keep going: local and Actions caches can have different numeric prefixes.
    }
  }
  for (const item of await findLocalBlackRockVotePdfs()) {
    byPath.set(item.file_path, item);
  }
  return [...byPath.values()];
}

const sourceItems = await buildSourceList(manifest);

const records = [];
const profiles = [];
for (const source of sourceItems) {
  const filePath = source.file_path ? path.resolve(ROOT, source.file_path) : path.join(SOURCE_DIR, source.file_name);
  const fileName = source.file_name ?? path.basename(filePath);
  try {
    const parsed = await extractRowsFromPdf(filePath, source);
    records.push(...parsed.rows);
    profiles.push({
      investor_id: "blackrock",
      source_title: source?.title ?? fileName,
      source_url: source?.url ?? "",
      source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
      pages: parsed.pages,
      text_length: parsed.text_sample.length,
      extracted_rows: parsed.rows.length,
      parser_note: "PDFの編集・ロック解除・パスワード解除は行わず、通常抽出できるテキスト層のみを使用。",
      text_sample: parsed.text_sample,
    });
    console.log(`Parsed ${parsed.rows.length} rows from ${fileName}`);
  } catch (error) {
    const message = error?.message ?? String(error);
    profiles.push({
      investor_id: "blackrock",
      source_title: source?.title ?? fileName,
      source_url: source?.url ?? "",
      source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
      pages: 0,
      text_length: 0,
      extracted_rows: 0,
      parser_note: message.includes("Password")
        ? "パスワード付きPDFのためスキップ。解除・回避処理は実行しない。"
        : `PDF通常抽出に失敗したためスキップ: ${message}`,
      text_sample: "",
    });
    console.warn(`Skipped ${fileName}: ${message}`);
  }
}

const cases = buildCases(records);
cases.records = records;

await fs.writeFile(SUMMARY_FILE, `${JSON.stringify(summarize(records, profiles), null, 2)}\n`, "utf8");
await fs.writeFile(CASES_FILE, `${JSON.stringify(cases, null, 2)}\n`, "utf8");
await fs.writeFile(TEXT_SAMPLES_FILE, `${JSON.stringify({ generated_at: new Date().toISOString(), profiles }, null, 2)}\n`, "utf8");

console.log(`Wrote ${path.relative(ROOT, SUMMARY_FILE)}`);
console.log(`Wrote ${path.relative(ROOT, CASES_FILE)}`);
console.log(`Wrote ${path.relative(ROOT, TEXT_SAMPLES_FILE)}`);
