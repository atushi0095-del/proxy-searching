import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const SUMMARY_FILE = path.join(ROOT, "data", "generated", "nomura_am_vote_summary.json");
const CASES_FILE = path.join(ROOT, "data", "generated", "nomura_am_vote_cases.json");

const AGAINST = "反対";
const FOR = "賛成";

const ISSUE_PATTERNS = [
  ["tenure", ["在任", "長期在任"]],
  ["low_roe", ["ROE", "自己資本利益率", "業績"]],
  ["low_pbr", ["PBR"]],
  ["low_tsr", ["TSR", "株価"]],
  ["board_independence", ["取締役会", "社外取締役", "独立社外取締役", "構成"]],
  ["gender_diversity", ["女性", "多様性", "ダイバーシティ"]],
  ["attendance", ["出席"]],
  ["overboarding", ["兼任", "兼職"]],
  ["policy_shareholdings", ["政策保有"]],
  ["independence_failure", ["独立性", "独立"]],
  ["compensation", ["報酬", "賞与", "退職慰労金", "ストックオプション"]],
  ["takeover_defense", ["買収防衛"]],
  ["shareholder_proposal", ["株主提案"]]
];

function classifyReason(reason, proposalType) {
  const text = `${reason ?? ""} ${proposalType ?? ""}`;
  const matched = ISSUE_PATTERNS.filter(([, terms]) =>
    terms.some((term) => text.includes(term))
  ).map(([issueType]) => issueType);
  return matched.length > 0 ? matched : ["other"];
}

function normalizeVote(value) {
  const text = String(value ?? "");
  if (text.includes("反対")) return AGAINST;
  if (text.includes("賛成")) return FOR;
  if (text.includes("棄権")) return "棄権";
  return text || "UNKNOWN";
}

function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

function parseWorkbook(filePath, source) {
  const workbook = XLSX.readFile(filePath);
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: ""
    });
    const headerIndex = rows.findIndex((row) => {
      const normalized = row.map(normalizeHeader);
      return normalized.includes("企業コード") && normalized.includes("企業名") && normalized.includes("賛否・理由");
    });
    if (headerIndex < 0) continue;

    const header = rows[headerIndex].map(normalizeHeader);
    const indexOf = (name) => header.findIndex((value) => value === name);
    const voteIndex = indexOf("賛否・理由");
    const idx = {
      code: indexOf("企業コード"),
      name: indexOf("企業名"),
      meetingType: indexOf("総会種類"),
      meetingDate: indexOf("総会日年/月/日"),
      proposer: indexOf("提案者"),
      proposalNumber: indexOf("議案番号"),
      proposalType: indexOf("議案分類"),
      vote: voteIndex,
      reason: voteIndex + 1
    };

    for (const [offset, row] of rows.slice(headerIndex + 1).entries()) {
      if (!row[idx.code] || !row[idx.name]) continue;
      const vote = normalizeVote(row[idx.vote]);
      const reason = String(row[idx.reason] ?? "");
      const proposalType = String(row[idx.proposalType] ?? "");
      records.push({
        investor_id: "nomura_am",
        source_title: source?.title ?? path.basename(filePath),
        source_url: source?.url ?? "",
        source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
        row_number: headerIndex + offset + 2,
        company_code: String(row[idx.code]),
        company_name: String(row[idx.name]),
        meeting_date: String(row[idx.meetingDate]),
        meeting_type: String(row[idx.meetingType]),
        proposal_number: String(row[idx.proposalNumber]),
        sub_proposal_number: "",
        proposer: String(row[idx.proposer]),
        proposal_type: proposalType,
        vote,
        reason,
        issue_types: classifyReason(reason, proposalType)
      });
    }
  }
  return records;
}

function addCount(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function summarize(records) {
  const byVote = {};
  const byProposalType = {};
  const byIssueType = {};
  const byReason = {};
  for (const record of records) {
    addCount(byVote, record.vote);
    addCount(byProposalType, `${record.proposal_type} / ${record.vote}`);
    for (const issueType of record.issue_types) {
      addCount(byIssueType, `${issueType} / ${record.vote}`);
    }
    if (record.vote === AGAINST) addCount(byReason, record.reason || "理由なし");
  }
  return {
    generated_at: new Date().toISOString(),
    total_records: records.length,
    by_vote: byVote,
    by_proposal_type: byProposalType,
    by_issue_type: byIssueType,
    top_against_reasons: Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([reason, count]) => ({ reason, count }))
  };
}

function buildCases(records) {
  const issueTypes = [...new Set(records.flatMap((record) => record.issue_types))]
    .filter((issueType) => issueType !== "other")
    .sort();
  return {
    generated_at: new Date().toISOString(),
    purpose: "野村アセットマネジメントの個別開示Excelから、反対理由と賛成近接事例を抽出するための中間データ。",
    issues: issueTypes.map((issueType) => {
      const allAgainst = records.filter(
        (record) => record.vote === AGAINST && record.issue_types.includes(issueType)
      );
      const companyCodes = new Set(allAgainst.slice(0, 100).map((record) => record.company_code));
      const allNearbyFor = records.filter(
        (record) => record.vote === FOR && companyCodes.has(record.company_code)
      );
      return {
        issue_type: issueType,
        against_count: allAgainst.length,
        against_examples: allAgainst.slice(0, 20),
        for_comparison_count: allNearbyFor.length,
        for_comparison_examples: allNearbyFor.slice(0, 20),
        inference_hint: "反対理由と同一企業の賛成議案を比較し、公式基準と実際の反対対象を分けて確認する。"
      };
    })
  };
}

const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const files = manifest
  .filter((item) => item.investor_id === "nomura_am" && item.kind === "vote_result_excel" && item.file_name)
  .map((item) => item.file_name)
  .filter((fileName, index, self) => self.indexOf(fileName) === index);

const records = [];
for (const fileName of files) {
  const filePath = path.join(SOURCE_DIR, fileName);
  const source = manifest.find((item) => item.file_name === fileName);
  const parsed = parseWorkbook(filePath, source);
  records.push(...parsed);
  console.log(`Parsed ${parsed.length} rows from ${fileName}`);
}

await writeFile(SUMMARY_FILE, `${JSON.stringify(summarize(records), null, 2)}\n`, "utf8");
await writeFile(CASES_FILE, `${JSON.stringify(buildCases(records), null, 2)}\n`, "utf8");

console.log(`Wrote ${SUMMARY_FILE}`);
console.log(`Wrote ${CASES_FILE}`);
