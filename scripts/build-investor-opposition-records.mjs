import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT = path.join(GENERATED_DIR, "investor_opposition_records.json");
const DIRECTORS_PATH = path.join(ROOT, "data", "directors.json");
const DOCUMENT_SOURCES_PATH = path.join(ROOT, "data", "document_sources.json");
const SPLIT_RECORDS_DIR = path.join(GENERATED_DIR, "opposition_records_by_investor");
const PRESERVE_SPLIT_INVESTORS = ["blackrock"];

const CASE_FILES = [
  "blackrock_vote_cases.json",
  "mufg_vote_cases.json",
  "nomura_am_vote_cases.json",
  "resona_am_vote_cases.json",
  "daiwa_am_vote_cases.json",
  "sumitomo_mitsui_trust_am_vote_cases.json",
  "amova_am_vote_cases.json",
  "mufg_am_vote_cases.json",
  "nissay_am_vote_cases.json",
  "fidelity_japan_vote_cases.json",
];

function text(value) {
  return String(value ?? "").trim();
}

function cleanReason(value) {
  return text(value);
}

function normalizeVote(value) {
  const vote = text(value);
  // Normalize garbled Shift-JIS mojibake variants of 賛成/反対
  if (vote === "賛成" || vote.includes("雉帶") || vote.includes("陷ｿ讎奇ｽｯ")) return "賛成";
  if (vote === "反対" || vote.includes("蜿榊ｯｾ") || vote.includes("髮牙ｸｶ")) return "反対";
  // mufg_am の「基準に該当」系は実質的に反対（ガイドライン基準抵触による反対投票）
  if (/基準に該当|適性基準|構成の基準|希薄化率/.test(vote)) return "反対";
  // 棄権はそのまま保持
  if (vote === "棄権") return "棄権";
  // 判断（ニッセイ等）はそのまま保持
  if (vote === "判断") return "判断";
  return vote || "不明";
}

function normalizeResolution(raw) {
  const proposalNumber = text(raw.proposal_number);
  const candidateNumber = text(raw.sub_proposal_number ?? raw.candidate_number ?? raw.role_text ?? raw.director_name);
  const proposalType = text(raw.proposal_type);
  const compactCandidate = candidateNumber.match(/^\d+(\.\d+)?$/) ? candidateNumber : "";

  if (proposalNumber) {
    const split = proposalNumber.match(/^(\d+)[.\-ー－](\d+)$/);
    return {
      resolution_number: split ? split[1] : proposalNumber,
      candidate_number: compactCandidate || (split ? split[2] : ""),
      proposal_title_normalized: proposalType.replace(/[0-9]+[.\-ー－][0-9]+$/, "").trim() || proposalType,
    };
  }

  const embedded = proposalType.match(/^(.*?)(\d+)[.\-ー－](\d+)$/);
  if (embedded) {
    return {
      resolution_number: embedded[2],
      candidate_number: compactCandidate || embedded[3],
      proposal_title_normalized: embedded[1].trim(),
    };
  }

  const tailNumber = proposalType.match(/^(.*?)(\d+)$/);
  if (tailNumber && /(蜿也ｷ蠖ｹ|逶｣譟ｻ蠖ｹ|陬懈ｬ|驕ｸ隗｣莉ｻ|驕ｸ莉ｻ)/.test(tailNumber[1])) {
    return {
      resolution_number: tailNumber[2],
      candidate_number: compactCandidate,
      proposal_title_normalized: tailNumber[1].trim(),
    };
  }

  return {
    resolution_number: proposalNumber,
    candidate_number: compactCandidate,
    proposal_title_normalized: proposalType,
  };
}

function inferResolutionType(proposalTitle) {
  const title = text(proposalTitle);
  if (/取締役|監査等委員|Director|director/.test(title)) return "取締役候補者";
  if (/監査役|Audit/.test(title)) return "監査役候補者";
  if (/会計監査|Accounting/.test(title)) return "会計監査人";
  if (/報酬|株式報酬|退職慰労|Compensation/.test(title)) return "報酬議案";
  if (/買収防衛|ポイズンピル|Takeover/.test(title)) return "買収防衛策";
  if (/株主提案|Shareholder/.test(title)) return "株主提案";
  return "議案";
}

function inferTarget(raw, issueType, resolution) {
  const roleText = text(raw.director_name ?? raw.role_text);
  const resolutionType = inferResolutionType(resolution.proposal_title_normalized);
  const hasCandidate = Boolean(resolution.candidate_number);
  const targetLabel = hasCandidate ? `${resolutionType} ${resolution.candidate_number}番` : resolutionType;

  if (hasCandidate && /取締役|監査役|候補者/.test(resolutionType)) {
    return {
      target_resolution_type: resolutionType,
      target_label: roleText && roleText !== resolution.candidate_number ? `${targetLabel}: ${roleText}` : targetLabel,
      target_candidate_number: resolution.candidate_number,
      match_method: "議案番号・候補者番号",
      target_confidence: "Medium-High",
    };
  }

  if (issueType === "low_roe" || issueType === "low_pbr" || issueType === "low_tsr") {
    return {
      target_resolution_type: "責任者候補",
      target_label: "経営トップ・取締役会議長等",
      target_candidate_number: "",
      match_method: "理由・ガイドライン推定",
      target_confidence: "Medium",
    };
  }

  if (issueType === "board_independence" || issueType === "gender_diversity") {
    return {
      target_resolution_type: "責任者候補",
      target_label: "取締役候補者または指名責任者",
      target_candidate_number: "",
      match_method: "論点推定",
      target_confidence: "Medium",
    };
  }

  if (issueType === "compensation") {
    return {
      target_resolution_type: "報酬議案",
      target_label: "報酬議案",
      target_candidate_number: "",
      match_method: "議案名",
      target_confidence: "Medium",
    };
  }

  return {
    target_resolution_type: resolutionType,
    target_label: targetLabel,
    target_candidate_number: resolution.candidate_number,
    match_method: resolution.proposal_title_normalized ? "議案名" : "未特定",
    target_confidence: resolution.proposal_title_normalized ? "Low-Medium" : "Low",
  };
}

function addCompensationDetailTags(tags, haystack) {
  const isCompensation = /報酬|株式報酬|退職慰労|ストックオプション|Compensation|RSU|PSU|RS/.test(haystack);
  if (!isCompensation) return;
  tags.add("役員報酬");
  const isStockBased = /株式|RSU|PSU|RS|ストックオプション/.test(haystack);
  const isPerformanceLinked = /業績|KPI|TSR|ROE|ROIC|EPS|performance/i.test(haystack);
  const isOutside = /社外|監査|outside/i.test(haystack);
  const isInside = /社内|業務執行|inside/i.test(haystack) || (!isOutside && /取締役/.test(haystack));
  const isCash = /金銭|金額|基本報酬|退職慰労/.test(haystack) && !isStockBased;
  if (isCash) tags.add("金額報酬");
  if (!isStockBased) return;
  tags.add("株式報酬");
  if (isPerformanceLinked && isInside) tags.add("業績連動株式報酬（社内）");
  if (!isPerformanceLinked && isInside) tags.add("業績非連動株式報酬（社内）");
  if (isPerformanceLinked && isOutside) tags.add("業績連動株式報酬（社外）");
  if (!isPerformanceLinked && isOutside) tags.add("業績非連動株式報酬（社外）");
}

function inferDetailTags(raw, issueType = "") {
  const haystack = [raw.director_name, raw.role_text, cleanReason(raw.reason), raw.proposal_type].map(text).join(" ");
  const tags = new Set();
  if (/社外|outside/i.test(haystack)) tags.add("社外取締役等");
  if (/社内|inside/i.test(haystack)) tags.add("社内取締役等");
  if (/独立|independent/i.test(haystack)) tags.add("独立性関連");
  if (/女性|ジェンダー|gender|diversity/i.test(haystack)) tags.add("女性・ジェンダー");
  if (/代表権/.test(haystack)) tags.add("代表権あり");
  if (/会長|chair/i.test(haystack)) tags.add("会長");
  if (/社長|CEO/i.test(haystack)) tags.add("社長・CEO");
  if (/買収防衛|ポイズンピル/.test(haystack)) tags.add("買収防衛策");
  if (/政策保有/.test(haystack)) tags.add("政策保有株式");
  if (/出席/.test(haystack)) tags.add("出席率");
  addCompensationDetailTags(tags, haystack);
  if (/ROE|PBR|TSR|資本効率/.test(haystack)) tags.add("資本効率");
  if (issueType === "shareholder_proposal") tags.add("株主提案");
  if (issueType === "takeover_defense") tags.add("買収防衛策");
  if (issueType === "policy_shareholdings") tags.add("政策保有株式");
  if (issueType === "tenure") tags.add("在任期間");
  if (issueType === "board_independence") tags.add("取締役会構成");
  if (issueType === "independence_failure") tags.add("独立性関連");
  if (issueType === "gender_diversity") tags.add("女性・ジェンダー");
  if (issueType === "compensation") { tags.add("役員報酬"); addCompensationDetailTags(tags, haystack); }
  if (issueType === "low_roe" || issueType === "low_pbr" || issueType === "low_tsr") tags.add("資本効率");
  return [...tags];
}

function refineIssueType(raw, issueType) {
  const haystack = [cleanReason(raw.reason), raw.proposal_type, raw.director_name, raw.role_text].map(text).join(" ");
  if (/買収防衛|ポイズンピル|Takeover/i.test(haystack)) return "takeover_defense";
  if (/政策保有|保有株式/.test(haystack)) return "policy_shareholdings";
  if (/報酬|株式報酬|退職慰労|ストックオプション|Compensation/i.test(haystack)) return "compensation";
  if (/女性|ジェンダー|多様性|gender|diversity/i.test(haystack)) return "gender_diversity";
  if (/在任|任期|12年/.test(haystack)) return "tenure";
  const hasBoard = /独立.{0,8}社外取締役|社外取締役|取締役会|3分の1|三分の一/.test(haystack);
  const hasCapital = /ROE|PBR|TSR|資本効率|株価/.test(haystack);
  if (hasBoard && !hasCapital) return "board_independence";
  return issueType;
}

function issueTypeForExample(raw, baseIssueType) {
  const vote = normalizeVote(raw.vote);
  const reason = cleanReason(raw.reason);
  if (vote === "反対" && !reason) return "other";

  const ownIssueTypes = Array.isArray(raw.issue_types) ? raw.issue_types.map(text).filter(Boolean) : [];
  const refined = vote === "反対" && ownIssueTypes.length > 0 && !ownIssueTypes.includes(baseIssueType)
    ? refineIssueType(raw, ownIssueTypes[0])
    : refineIssueType(raw, baseIssueType);
  const proposalType = text(raw.proposal_type);
  const isDirectorElection = /取締役|監査役|候補者|選任|選解任/.test(proposalType);
  if (vote === "反対" && !isDirectorElection && (refined === "board_independence" || refined === "independence_failure" || refined === "tenure")) {
    return "other";
  }

  return refined;
}

function recordSortNumber(value) {
  const match = text(value).match(/\d+/);
  return match ? Number(match[0]) : 9999;
}

async function buildCompanyNameMap() {
  // Build company_code → company_name lookup from companies.json and all case files
  const map = new Map();
  // Load from companies.json first
  try {
    const companies = JSON.parse(await fs.readFile(path.join(ROOT, "data", "companies.json"), "utf8"));
    for (const c of companies) {
      if (c.company_code && c.company_name) map.set(String(c.company_code), String(c.company_name));
    }
  } catch {}
  // Supplement from case files (read records directly to avoid dependency)
  for (const fileName of CASE_FILES) {
    const filePath = path.join(GENERATED_DIR, fileName);
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      const rawRecords = Array.isArray(parsed.records) ? parsed.records : [];
      for (const raw of rawRecords) {
        const code = String(raw.company_code ?? "").trim();
        const name = String(raw.company_name ?? "").trim();
        if (code && name && !map.has(code)) map.set(code, name);
      }
    } catch {}
  }
  return map;
}

async function loadDirectors() {
  try {
    return JSON.parse(await fs.readFile(DIRECTORS_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function loadDocumentSources() {
  try {
    return JSON.parse(await fs.readFile(DOCUMENT_SOURCES_PATH, "utf8"));
  } catch {
    return [];
  }
}

function buildNoticeUrlMap(documentSources) {
  const map = new Map();
  for (const source of documentSources) {
    if (source.document_type !== "notice_of_meeting" || !source.url) continue;
    map.set(`${text(source.company_code)}:${Number(source.meeting_year) || ""}`, text(source.url));
  }
  return map;
}

function noticeUrlForRecord(map, companyCode, meetingDate) {
  const year = meetingYearFrom(meetingDate);
  return map.get(`${companyCode}:${year}`) || "";
}

function meetingYearFrom(value) {
  const match = text(value).match(/(\d{4})/);
  return match ? Number(match[1]) : 2025;
}

function buildDirectorGroups(directors) {
  const groups = new Map();
  for (const director of directors) {
    const key = `${text(director.company_code)}:${Number(director.meeting_year) || ""}`;
    const arr = groups.get(key) ?? [];
    arr.push(director);
    groups.set(key, arr);
  }
  return groups;
}

function findMatchedDirector(groups, companyCode, meetingDate, candidateNumber) {
  const parsedCandidate = Number(candidateNumber);
  if (!Number.isInteger(parsedCandidate) || parsedCandidate <= 0) return null;
  const year = meetingYearFrom(meetingDate);
  const exact = groups.get(`${companyCode}:${year}`);
  if (exact?.[parsedCandidate - 1]) {
    return { director: exact[parsedCandidate - 1], method: "候補者番号順照合", confidence: "Medium" };
  }
  const fallback = [...groups.entries()]
    .filter(([key]) => key.startsWith(`${companyCode}:`))
    .map(([key, directors]) => ({ year: Number(key.split(":")[1]), directors }))
    .filter((entry) => Number.isFinite(entry.year) && entry.year <= year)
    .sort((a, b) => b.year - a.year)[0];
  if (fallback?.directors?.[parsedCandidate - 1]) {
    return { director: fallback.directors[parsedCandidate - 1], method: `候補者番号順照合（${fallback.year}年役員データ）`, confidence: "Low-Medium" };
  }
  return null;
}

function directorAttributeTags(director) {
  if (!director) return [];
  const tags = [];
  tags.push(director.is_female ? "女性" : "男性");
  if (director.is_inside_director) tags.push("社内取締役");
  if (director.is_outside_director) tags.push("社外取締役");
  if (director.is_independent) tags.push("独立");
  if (director.is_outside_director && !director.is_independent) tags.push("非独立");
  if (director.is_president) tags.push("社長");
  if (director.is_ceo) tags.push("CEO");
  if (director.is_chair) tags.push("会長");
  if (director.has_representative_authority) tags.push("代表権あり");
  if (director.is_chair && !director.has_representative_authority) tags.push("代表権なし会長");
  if (director.is_board_chair) tags.push("取締役会議長");
  if (director.is_nominating_committee_chair) tags.push("指名委員長");
  if (director.is_compensation_committee_chair) tags.push("報酬委員長");
  if (director.is_audit_committee_chair) tags.push("監査委員長");
  if (director.tenure_years_after_reelection !== null && director.tenure_years_after_reelection !== undefined) tags.push(`再任後在任${director.tenure_years_after_reelection}年`);
  if (director.board_attendance_rate !== null && director.board_attendance_rate !== undefined) tags.push(`取締役会出席${director.board_attendance_rate}%`);
  return [...new Set(tags)];
}

function directorMatchFields(recordBase, groups) {
  const match = findMatchedDirector(groups, recordBase.company_code, recordBase.meeting_date, recordBase.candidate_number);
  if (!match?.director) {
    return {
      matched_director_id: "",
      matched_director_name: "",
      matched_director_title: "",
      matched_director_attributes: [],
      director_match_method: "未照合",
      director_match_confidence: "Low",
    };
  }
  return {
    matched_director_id: text(match.director.director_id),
    matched_director_name: text(match.director.name),
    matched_director_title: text(match.director.current_title),
    matched_director_attributes: directorAttributeTags(match.director),
    director_match_method: match.method,
    director_match_confidence: match.confidence,
  };
}

function primaryIssueType(raw) {
  const ownIssueTypes = Array.isArray(raw.issue_types) ? raw.issue_types.map(text).filter(Boolean) : [];
  return ownIssueTypes.find((issueType) => issueType !== "other") ?? ownIssueTypes[0] ?? "other";
}

function examplesFromCaseFile(parsed) {
  if (Array.isArray(parsed.records)) {
    return parsed.records.map((raw) => ({ raw, baseIssueType: primaryIssueType(raw) }));
  }

  const examples = [];
  for (const issue of parsed.issues ?? []) {
    const baseIssueType = text(issue.issue_type) || "other";
    for (const raw of [...(issue.against_examples ?? []), ...(issue.for_comparison_examples ?? [])]) {
      examples.push({ raw, baseIssueType });
    }
  }
  return examples;
}

function compactTargetFields(target) {
  const { target_notes, ...compact } = target;
  return compact;
}

function compactDirectorFields(fields) {
  const { director_match_notes, ...compact } = fields;
  return compact;
}

async function loadPreservedSplitRecords(records, seen) {
  const presentInvestors = new Set(records.map((record) => record.investor_id));
  for (const investorId of PRESERVE_SPLIT_INVESTORS) {
    if (presentInvestors.has(investorId)) continue;
    const filePath = path.join(SPLIT_RECORDS_DIR, `${investorId}.json`);
    let parsed;
    try {
      parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
      continue;
    }
    const preserved = Array.isArray(parsed.records) ? parsed.records : [];
    for (const rawRecord of preserved) {
      const record = {
        ...rawRecord,
        investor_id: text(rawRecord.investor_id) || investorId,
        vote: normalizeVote(rawRecord.vote),
      };
      const key = [
        record.investor_id,
        record.company_code,
        record.meeting_date,
        record.proposal_number,
        record.resolution_number,
        record.candidate_number,
        record.reason,
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    }
    console.log(`Preserved ${preserved.length} ${investorId} records from split data`);
  }
}

const companyNameMap = await buildCompanyNameMap();
const directors = await loadDirectors();
const directorGroups = buildDirectorGroups(directors);
const documentSources = await loadDocumentSources();
const noticeUrlMap = buildNoticeUrlMap(documentSources);
const records = [];
const seen = new Set();

for (const fileName of CASE_FILES) {
  const filePath = path.join(GENERATED_DIR, fileName);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    continue;
  }

  for (const { raw, baseIssueType } of examplesFromCaseFile(parsed)) {
      const issueType = issueTypeForExample(raw, baseIssueType);
      const resolution = normalizeResolution(raw);
      const target = inferTarget(raw, issueType, resolution);
      const companyCode = text(raw.company_code);
      const rawCompanyName = text(raw.company_name);
      const resolvedCompanyName = rawCompanyName || companyNameMap.get(companyCode) || "";
      const recordBase = {
        investor_id: text(raw.investor_id),
        company_code: companyCode,
        company_name: resolvedCompanyName,
        meeting_date: text(raw.meeting_date ?? raw.meeting_year),
        proposal_number: text(raw.proposal_number),
        resolution_number: resolution.resolution_number,
        candidate_number: resolution.candidate_number,
        proposal_type: text(raw.proposal_type),
        proposal_title_normalized: resolution.proposal_title_normalized,
        director_or_role: text(raw.director_name ?? raw.role_text),
        vote: normalizeVote(raw.vote),
        issue_type: issueType,
        detail_tags: inferDetailTags(raw, issueType),
        ...compactTargetFields(target),
        reason: cleanReason(raw.reason),
        source_url: text(raw.source_url),
        source_title: text(raw.source_title),
        convocation_notice_url: noticeUrlForRecord(noticeUrlMap, companyCode, text(raw.meeting_date ?? raw.meeting_year)),
      };
      const record = {
        ...recordBase,
        ...compactDirectorFields(directorMatchFields(recordBase, directorGroups)),
      };

      const key = [
        record.investor_id,
        record.company_code,
        record.meeting_date,
        record.proposal_number,
        record.resolution_number,
        record.candidate_number,
        record.reason,
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
  }
}

await loadPreservedSplitRecords(records, seen);

records.sort((a, b) => {
  if (a.investor_id !== b.investor_id) return a.investor_id.localeCompare(b.investor_id);
  if (a.company_code !== b.company_code) return a.company_code.localeCompare(b.company_code);
  if (a.meeting_date !== b.meeting_date) return b.meeting_date.localeCompare(a.meeting_date);
  const resolutionDiff = recordSortNumber(a.resolution_number || a.proposal_number) - recordSortNumber(b.resolution_number || b.proposal_number);
  if (resolutionDiff !== 0) return resolutionDiff;
  const candidateDiff = recordSortNumber(a.candidate_number) - recordSortNumber(b.candidate_number);
  if (candidateDiff !== 0) return candidateDiff;
  return a.proposal_type.localeCompare(b.proposal_type);
});

await fs.mkdir(GENERATED_DIR, { recursive: true });
const handle = await fs.open(OUTPUT, "w");
try {
  await handle.write("{\n");
  await handle.write(`  "generated_at": ${JSON.stringify(new Date().toISOString())},\n`);
  await handle.write(`  "purpose": ${JSON.stringify("投資家別に反対先・反対理由・推定論点を一覧表示し、CSV出力するための正規化データ。")},\n`);
  await handle.write(`  "source_files": ${JSON.stringify(CASE_FILES)},\n`);
  await handle.write(`  "total_records": ${records.length},\n`);
  await handle.write('  "records": [\n');
  for (let i = 0; i < records.length; i += 1) {
    await handle.write(`    ${JSON.stringify(records[i])}${i === records.length - 1 ? "\n" : ",\n"}`);
  }
  await handle.write("  ]\n");
  await handle.write("}\n");
} finally {
  await handle.close();
}

console.log(`Built ${path.relative(ROOT, OUTPUT)} with ${records.length} records`);
