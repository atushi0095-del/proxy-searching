import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = process.cwd();
const REGISTRY_FILE = path.join(ROOT, "data", "generated", "source_registry.json");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources");
const SUMMARY_FILE = path.join(ROOT, "data", "generated", "mufg_vote_summary.json");
const CASES_FILE = path.join(ROOT, "data", "generated", "mufg_vote_cases.json");

const AGAINST = "反対";
const FOR = "賛成";

const ISSUE_PATTERNS = [
  ["tenure", ["在任期間"]],
  ["low_roe", ["ROE", "自己資本利益率"]],
  ["board_independence", ["取締役構成"]],
  ["gender_diversity", ["女性取締役不在", "女性役員", "女性"]],
  ["attendance", ["出席率", "出席"]],
  ["overboarding", ["兼任", "兼職"]],
  ["policy_shareholdings", ["政策保有"]],
  ["independence_failure", ["独立性"]],
  ["compensation", ["報酬", "支給", "退職慰労金"]],
  ["takeover_defense", ["買収防衛", "敵対的買収防衛策"]],
  ["shareholder_proposal", ["株主提案"]],
];

function classifyReason(reason) {
  const text = String(reason ?? "");
  const matched = ISSUE_PATTERNS.filter(([, terms]) =>
    terms.some((term) => text.includes(term))
  ).map(([issueType]) => issueType);
  return matched.length > 0 ? matched : ["other"];
}

function sourceFileName(item, index) {
  const label = item.title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${String(index + 1).padStart(3, "0")}_${item.investor_id}_${item.kind}_${label}.xlsx`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDownloaded(item, index) {
  await mkdir(SOURCE_DIR, { recursive: true });
  const filePath = path.join(SOURCE_DIR, sourceFileName(item, index));
  if (await exists(filePath)) return filePath;

  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`${item.url} returned ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
}

function formatMeetingDate(value) {
  if (typeof value === "number" && value > 30000 && value < 60000) {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}${String(date.m).padStart(2, "0")}${String(date.d).padStart(2, "0")}`;
    }
  }
  return String(value ?? "");
}

function parseWorkbook(filePath, source) {
  const workbook = XLSX.readFile(filePath);
  const sheetName =
    workbook.SheetNames.find((name) => name.trim() === "議決権行使結果") ??
    workbook.SheetNames.find((name) => name.includes("会社別議案別行使結果")) ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  const headerIndex = rows.findIndex(
    (row) => (row.includes("銘柄コード") || row.includes("証券コード")) && row.includes("賛否")
  );
  if (headerIndex < 0) return [];

  const header = rows[headerIndex];
  const indexOf = (...names) => header.findIndex((value) => names.includes(value));
  const idx = {
    code: indexOf("銘柄コード", "証券コード"),
    name: indexOf("銘柄名称", "社名"),
    meetingDate: indexOf("総会日"),
    meetingType: indexOf("総会種類"),
    proposalNumber: indexOf("議案番号"),
    subProposalNumber: indexOf("子議案番号", "候補者番号"),
    proposer: indexOf("提案者"),
    proposalType: indexOf("議案分類"),
    vote: indexOf("賛否"),
    reason: header.findIndex((value) => String(value).startsWith("理由")),
  };

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row[idx.code])
    .map((row, rowOffset) => {
      const reason = String(row[idx.reason] ?? "");
      return {
        investor_id: "mufg_trust",
        source_title: source.title,
        source_url: source.url,
        source_file: path.relative(ROOT, filePath).replaceAll("\\", "/"),
        row_number: headerIndex + rowOffset + 2,
        company_code: String(row[idx.code]),
        company_name: String(row[idx.name]),
        meeting_date: formatMeetingDate(row[idx.meetingDate]),
        meeting_type: String(row[idx.meetingType]),
        proposal_number: String(row[idx.proposalNumber]),
        sub_proposal_number: String(row[idx.subProposalNumber]),
        proposer: String(row[idx.proposer]),
        proposal_type: String(row[idx.proposalType]),
        vote: String(row[idx.vote]),
        reason,
        issue_types: classifyReason(reason),
      };
    });
}

function addCount(map, key, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
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
    if (record.vote === AGAINST) {
      addCount(byReason, record.reason || "理由なし");
    }
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
      .map(([reason, count]) => ({ reason, count })),
  };
}

function buildCases(records) {
  const issueTypes = [...new Set(records.flatMap((record) => record.issue_types))]
    .filter((issueType) => issueType !== "other")
    .sort();

  return {
    generated_at: new Date().toISOString(),
    purpose:
      "三菱UFJ信託銀行の議決権行使結果から、反対された企業・議案と賛成された近接事例を抽出し、基準抵触の境界を分析するための中間データ。",
    records,
    issues: issueTypes.map((issueType) => {
      const allAgainst = records.filter(
        (record) => record.vote === AGAINST && record.issue_types.includes(issueType)
      );
      const against = allAgainst.slice(0, 80);
      const companyCodes = new Set(against.map((record) => record.company_code));
      const allNearbyFor = records.filter(
        (record) =>
          record.vote === FOR &&
          companyCodes.has(record.company_code) &&
          record.proposal_type.includes("取締役")
      );
      const nearbyFor = allNearbyFor.slice(0, 80);

      return {
        issue_type: issueType,
        against_count: allAgainst.length,
        against_examples: against.slice(0, 20),
        for_comparison_count: allNearbyFor.length,
        for_comparison_examples: nearbyFor.slice(0, 20),
        inference_hint:
          issueType === "tenure"
            ? "同一会社の取締役選任議案で、在任期間を理由に反対された候補と賛成された候補を比較し、12年到達時点か13年目かを会社開示の候補者略歴で照合する。"
            : "反対理由と賛成事例を会社・議案分類単位で比較し、公式基準と実際の反対対象候補を分けて確認する。",
      };
    }),
  };
}

const registry = JSON.parse(await readFile(REGISTRY_FILE, "utf8"));
const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const registryTargets = registry.filter(
  (item) => item.investor_id === "mufg_trust" && item.kind === "vote_result_excel"
);
const manifestTargets = manifest.filter(
  (item) => item.investor_id === "mufg_trust" && item.kind === "vote_result_excel" && item.file_path
);

const records = [];
for (const [index, target] of registryTargets.entries()) {
  const filePath = await ensureDownloaded(target, index);
  const parsed = parseWorkbook(filePath, target);
  records.push(...parsed);
  console.log(`Parsed ${parsed.length} rows from ${target.title}`);
}
for (const target of manifestTargets) {
  const filePath = path.join(ROOT, target.file_path);
  const parsed = parseWorkbook(filePath, target);
  records.push(...parsed);
  console.log(`Parsed ${parsed.length} rows from ${target.file_name}`);
}

await mkdir(path.dirname(SUMMARY_FILE), { recursive: true });
await writeFile(SUMMARY_FILE, JSON.stringify(summarize(records), null, 2), "utf8");
await writeFile(CASES_FILE, JSON.stringify(buildCases(records), null, 2), "utf8");

console.log(`Wrote ${SUMMARY_FILE}`);
console.log(`Wrote ${CASES_FILE}`);
