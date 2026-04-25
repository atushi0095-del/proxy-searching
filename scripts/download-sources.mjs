import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY_FILE = path.join(ROOT, "data", "generated", "source_registry.json");
const POLICY_FILE = path.join(ROOT, "data", "collection_policy.json");
const OUT_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");

const args = process.argv.slice(2);
const requestedKinds = new Set(args.filter((arg) => !arg.startsWith("--")));
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const downloadLimit = limitArg ? Number(limitArg.replace("--limit=", "")) : null;
const defaultKinds = new Set(["guideline", "vote_result", "vote_result_excel"]);

async function loadPolicy() {
  try {
    return JSON.parse(await readFile(POLICY_FILE, "utf8"));
  } catch {
    return {
      default_delay_ms: 2000,
      max_download_bytes: 30000000,
      user_agent: "proxy-vote-pattern-app-research/0.1"
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shouldDownload(item) {
  const kinds = requestedKinds.size > 0 ? requestedKinds : defaultKinds;
  return kinds.has(item.kind);
}

function extensionFor(item, contentType) {
  const fromUrl = new URL(item.url).pathname.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (contentType.includes("spreadsheet")) return "xlsx";
  if (contentType.includes("pdf")) return "pdf";
  return "bin";
}

function fileBase(item, index) {
  const label = item.title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${String(index + 1).padStart(3, "0")}_${item.investor_id}_${item.kind}_${label}`;
}

async function download(item, index, policy) {
  const contentTypeHint = item.url.toLowerCase().includes(".xlsx") ? "xlsx" : "";
  const extHint = item.url.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/)?.[1] ?? contentTypeHint;
  const precomputedName = `${fileBase(item, index)}.${extHint || "bin"}`;
  const precomputedPath = path.join(OUT_DIR, precomputedName);
  if (await exists(precomputedPath)) {
    return {
      ...item,
      file_name: precomputedName,
      file_path: path.relative(ROOT, precomputedPath).replaceAll("\\", "/"),
      skipped: "cached",
      downloaded_at: new Date().toISOString(),
    };
  }

  const res = await fetch(item.url, {
    headers: {
      "user-agent": policy.user_agent,
      "accept": "text/html,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*"
    }
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > policy.max_download_bytes) {
    throw new Error(`content-length ${contentLength} exceeds max_download_bytes ${policy.max_download_bytes}`);
  }
  const ext = extensionFor(item, contentType);
  const fileName = `${fileBase(item, index)}.${ext}`;
  const filePath = path.join(OUT_DIR, fileName);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > policy.max_download_bytes) {
    throw new Error(`downloaded ${buffer.length} bytes exceeds max_download_bytes ${policy.max_download_bytes}`);
  }
  await writeFile(filePath, buffer);
  return {
    ...item,
    file_name: fileName,
    file_path: path.relative(ROOT, filePath).replaceAll("\\", "/"),
    content_type: contentType,
    bytes: buffer.length,
    downloaded_at: new Date().toISOString(),
  };
}

const registry = JSON.parse(await readFile(REGISTRY_FILE, "utf8"));
const targets = registry.filter(shouldDownload).slice(0, downloadLimit ?? undefined);
const policy = await loadPolicy();

await mkdir(OUT_DIR, { recursive: true });

const downloaded = [];
for (const [index, item] of targets.entries()) {
  try {
    if (index > 0) await sleep(policy.default_delay_ms);
    const result = await download(item, index, policy);
    downloaded.push(result);
    console.log(`${result.skipped === "cached" ? "Cached" : "Downloaded"} ${result.file_name}`);
  } catch (error) {
    downloaded.push({
      ...item,
      error: error instanceof Error ? error.message : String(error),
      downloaded_at: new Date().toISOString(),
    });
    console.warn(`Skipped ${item.url}: ${error instanceof Error ? error.message : error}`);
  }
}

await writeFile(MANIFEST_FILE, JSON.stringify(downloaded, null, 2), "utf8");
console.log(`Wrote ${MANIFEST_FILE}`);
