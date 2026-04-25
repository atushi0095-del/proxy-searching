import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";

const inflate = promisify(zlib.inflate);
const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const SUMMARY_FILE = path.join(ROOT, "data", "generated", "blackrock_vote_summary.json");
const CASES_FILE = path.join(ROOT, "data", "generated", "blackrock_vote_cases.json");
const TEXT_SAMPLES_FILE = path.join(ROOT, "data", "generated", "blackrock_vote_text_samples.json");

function decodePdfLiteral(raw) {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function decodeHexString(hex) {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length < 2 || clean.length % 2 !== 0) return "";
  const bytes = Buffer.from(clean, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.subarray(2).toString("utf16le").replace(/\u0000/g, "");
  if (bytes.includes(0)) {
    const chars = [];
    for (let i = 0; i < bytes.length - 1; i += 2) chars.push(String.fromCharCode(bytes.readUInt16BE(i)));
    return chars.join("");
  }
  return bytes.toString("utf8");
}

async function inflateStreams(buffer) {
  const binary = buffer.toString("latin1");
  const chunks = [];
  let cursor = 0;
  while (true) {
    const streamIndex = binary.indexOf("stream", cursor);
    if (streamIndex < 0) break;
    const endIndex = binary.indexOf("endstream", streamIndex);
    if (endIndex < 0) break;
    const headerStart = Math.max(0, binary.lastIndexOf("<<", streamIndex));
    const header = binary.slice(headerStart, streamIndex);
    let dataStart = streamIndex + "stream".length;
    if (binary[dataStart] === "\r" && binary[dataStart + 1] === "\n") dataStart += 2;
    else if (binary[dataStart] === "\n" || binary[dataStart] === "\r") dataStart += 1;
    const data = buffer.subarray(dataStart, endIndex);
    if (header.includes("FlateDecode")) {
      try {
        chunks.push((await inflate(data)).toString("latin1"));
      } catch {
        // Some PDFs contain non-standard stream wrappers. Keep scanning other streams.
      }
    }
    cursor = endIndex + "endstream".length;
  }
  return chunks;
}

function extractTextFromStream(stream) {
  const parts = [];
  for (const match of stream.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    parts.push(decodePdfLiteral(match[1]));
  }
  for (const match of stream.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)) {
    const arrayText = [];
    for (const literal of match[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) arrayText.push(decodePdfLiteral(literal[1]));
    for (const hex of match[1].matchAll(/<([0-9A-Fa-f\s]+)>/g)) arrayText.push(decodeHexString(hex[1]));
    if (arrayText.length) parts.push(arrayText.join(""));
  }
  for (const match of stream.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    parts.push(decodeHexString(match[1]));
  }
  return parts.join("\n");
}

function classifyText(text) {
  const issueTypes = new Set();
  if (/ROE|資本効率|資本コスト|PBR/.test(text)) issueTypes.add("low_roe");
  if (/政策保有|保有株式/.test(text)) issueTypes.add("policy_shareholdings");
  if (/独立|社外取締役|取締役会/.test(text)) issueTypes.add("board_independence");
  if (/女性|ジェンダー/.test(text)) issueTypes.add("gender_diversity");
  if (/在任|任期|12年/.test(text)) issueTypes.add("tenure");
  if (/報酬|賞与|株式報酬/.test(text)) issueTypes.add("compensation");
  if (/買収防衛|ポイズンピル/.test(text)) issueTypes.add("takeover_defense");
  return [...issueTypes];
}

function summarizePdfText(text) {
  return {
    text_length: text.length,
    has_text_layer: text.replace(/\s+/g, "").length > 100,
    detected_issue_types: classifyText(text),
    contains_against: text.includes("反対"),
    contains_for: text.includes("賛成"),
  };
}

async function parsePdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const streams = await inflateStreams(buffer);
  const text = streams.map(extractTextFromStream).filter(Boolean).join("\n");
  return {
    file_path: path.relative(ROOT, filePath).replaceAll("\\", "/"),
    ...summarizePdfText(text),
    text_sample: text.replace(/\s+/g, " ").slice(0, 1200),
  };
}

const manifest = JSON.parse(await fs.readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const files = manifest
  .filter((item) => item.investor_id === "blackrock" && item.kind === "vote_result" && item.file_name?.endsWith(".pdf"))
  .map((item) => item.file_name)
  .filter((fileName, index, self) => self.indexOf(fileName) === index);

const profiles = [];
for (const fileName of files) {
  const filePath = path.join(SOURCE_DIR, fileName);
  const source = manifest.find((item) => item.file_name === fileName);
  const profile = await parsePdf(filePath);
  profiles.push({
    investor_id: "blackrock",
    source_title: source?.title ?? fileName,
    source_url: source?.url ?? "",
    source_file: profile.file_path,
    ...profile,
  });
  console.log(`Profiled ${fileName}: ${profile.text_length} chars`);
}

const summary = {
  investor_id: "blackrock",
  generated_at: new Date().toISOString(),
  source_format: "PDF",
  parser_status: files.length === 0
    ? "PDF未ダウンロード"
    : profiles.some((profile) => profile.has_text_layer)
      ? "PDFテキスト層の抽出まで完了。行単位の会社・議案テーブル化は次工程。"
      : "PDF取得済み。簡易テキスト抽出では本文を取得できないため、OCRまたはPDF表専用パーサが必要。",
  total_files: files.length,
  text_layer_files: profiles.filter((profile) => profile.has_text_layer).length,
  detected_issue_types: [...new Set(profiles.flatMap((profile) => profile.detected_issue_types))].sort(),
};

const cases = {
  investor_name: "BlackRock Investment",
  generated_at: summary.generated_at,
  parser_status: summary.parser_status,
  source_files: profiles.map((profile) => profile.source_file),
  issues: [],
};

await fs.writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await fs.writeFile(CASES_FILE, `${JSON.stringify(cases, null, 2)}\n`, "utf8");
await fs.writeFile(TEXT_SAMPLES_FILE, `${JSON.stringify({ generated_at: summary.generated_at, profiles }, null, 2)}\n`, "utf8");

console.log(`Wrote ${path.relative(ROOT, SUMMARY_FILE)}`);
console.log(`Wrote ${path.relative(ROOT, CASES_FILE)}`);
console.log(`Wrote ${path.relative(ROOT, TEXT_SAMPLES_FILE)}`);
