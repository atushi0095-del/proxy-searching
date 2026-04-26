import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FILINGS_FILE = path.join(ROOT, "data", "generated", "edinet_filings.json");
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources", "edinet");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "edinet_download_manifest.json");
const API_BASE = "https://api.edinet-fsa.go.jp/api/v2";
const API_KEY = process.env.EDINET_API_KEY;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);

function usage() {
  console.log(`Usage:
  EDINET_API_KEY=... npm run edinet:download -- --limit=3 --type=1

Options:
  --limit=3       Optional. Max documents to download.
  --type=1        Optional. EDINET document API type. Use the EDINET API v2 specification for valid values.
  --delay=2000    Optional. Delay per API request in ms.
`);
}

function assertApiKey() {
  if (!API_KEY) {
    usage();
    throw new Error("EDINET_API_KEY is not set.");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDocument(docId, type) {
  const url = new URL(`${API_BASE}/documents/${docId}`);
  url.searchParams.set("type", String(type));
  url.searchParams.set("Subscription-Key", API_KEY);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EDINET document download failed for ${docId}: ${response.status} ${response.statusText}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

function extensionFor(contentType, type) {
  if (contentType.includes("pdf")) return ".pdf";
  if (contentType.includes("zip")) return ".zip";
  if (contentType.includes("json")) return ".json";
  return type === "2" ? ".pdf" : ".bin";
}

assertApiKey();

const filingsData = JSON.parse(await fs.readFile(FILINGS_FILE, "utf8"));
const filings = Array.isArray(filingsData.filings) ? filingsData.filings : [];
const limit = Number(args.get("limit") ?? 3);
const type = String(args.get("type") ?? "1");
const delay = Number(args.get("delay") ?? 2000);
const manifest = [];

await fs.mkdir(SOURCE_DIR, { recursive: true });

for (const filing of filings.slice(0, limit)) {
  const docId = filing.doc_id;
  if (!docId) continue;
  const downloaded = await fetchDocument(docId, type);
  const ext = extensionFor(downloaded.contentType, type);
  const fileName = `${filing.company_code}_${docId}_type${type}${ext}`;
  const filePath = path.join(SOURCE_DIR, fileName);
  await fs.writeFile(filePath, downloaded.buffer);
  manifest.push({
    ...filing,
    type,
    content_type: downloaded.contentType,
    bytes: downloaded.buffer.length,
    file_path: path.relative(ROOT, filePath).replaceAll("\\", "/"),
    downloaded_at: new Date().toISOString(),
  });
  console.log(`Downloaded ${fileName}`);
  await sleep(delay);
}

await fs.writeFile(
  MANIFEST_FILE,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      api: "EDINET API v2",
      total: manifest.length,
      documents: manifest,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Wrote ${path.relative(ROOT, MANIFEST_FILE)}`);
