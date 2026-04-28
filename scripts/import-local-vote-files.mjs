import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOWNLOADS = path.join(process.env.USERPROFILE ?? "C:\\Users\\atush", "Downloads");
const SOURCE_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");

const LOCAL_FOLDERS = [
  { investor_id: "nomura_am", folder: "野村アセットマネジメント", label: "野村アセットマネジメント" },
  { investor_id: "mufg_trust", folder: "三菱UFJ信託銀行", label: "三菱UFJ信託銀行" },
  { investor_id: "resona_am", folder: "りそな", label: "りそなアセットマネジメント" },
  { investor_id: "daiwa_am", folder: "大和", label: "大和アセットマネジメント" },
];

const ZIP_FILES = [
  { investor_id: "fidelity_japan", file: "FIJ_DisclosureReport_1Q2024.zip", label: "フィディリティ投信 2024年1Q ZIP" },
];

function extensionKind(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".csv") return { kind: "vote_result_excel", content_type: "text/csv" };
  if (ext === ".xls") return { kind: "vote_result_excel", content_type: "application/vnd.ms-excel" };
  if (ext === ".xlsx") {
    return {
      kind: "vote_result_excel",
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  if (ext === ".zip") return { kind: "vote_result_archive", content_type: "application/zip" };
  return null;
}

function safeName(value) {
  return value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_FILE, "utf8"));
  } catch {
    return [];
  }
}

function localSourceId(investorId, fileName) {
  return `local_${investorId}_${safeName(fileName).toLowerCase()}`;
}

function hasManifestItem(manifest, sourceId) {
  return manifest.some((item) => item.source_id === sourceId);
}

async function addFile(manifest, investor, sourcePath, originalFileName) {
  const kindInfo = extensionKind(originalFileName);
  if (!kindInfo) return false;

  const sourceId = localSourceId(investor.investor_id, originalFileName);
  const destFileName = `${sourceId}${path.extname(originalFileName).toLowerCase()}`;
  const destPath = path.join(SOURCE_DIR, destFileName);
  await copyFile(sourcePath, destPath);

  if (!hasManifestItem(manifest, sourceId)) {
    const size = (await stat(destPath)).size;
    manifest.push({
      investor_id: investor.investor_id,
      title: `${investor.label} 議決権行使結果 ${originalFileName}`,
      url: "",
      kind: kindInfo.kind,
      source_id: sourceId,
      language: "ja",
      source_document_type: "vote_result",
      discovered_at: new Date().toISOString(),
      discovery_method: "local_user_upload",
      file_name: destFileName,
      file_path: path.relative(ROOT, destPath).replaceAll("\\", "/"),
      content_type: kindInfo.content_type,
      bytes: size,
      downloaded_at: new Date().toISOString(),
      original_local_path: sourcePath,
    });
  }

  return true;
}

await mkdir(SOURCE_DIR, { recursive: true });
const manifest = await loadManifest();
let copied = 0;

for (const investor of LOCAL_FOLDERS) {
  const folderPath = path.join(DOWNLOADS, investor.folder);
  if (!existsSync(folderPath)) {
    console.warn(`Missing local folder: ${folderPath}`);
    continue;
  }
  for (const fileName of await readdir(folderPath)) {
    const sourcePath = path.join(folderPath, fileName);
    const info = await stat(sourcePath);
    if (!info.isFile()) continue;
    if (await addFile(manifest, investor, sourcePath, fileName)) {
      copied += 1;
      console.log(`Imported ${investor.investor_id}: ${fileName}`);
    }
  }
}

for (const zip of ZIP_FILES) {
  const sourcePath = path.join(DOWNLOADS, zip.file);
  if (!existsSync(sourcePath)) {
    console.warn(`Missing optional local archive: ${sourcePath}`);
    continue;
  }
  if (await addFile(manifest, zip, sourcePath, zip.file)) {
    copied += 1;
    console.log(`Imported ${zip.investor_id}: ${zip.file}`);
  }
}

manifest.sort((a, b) =>
  `${a.investor_id}:${a.source_id ?? a.file_name}`.localeCompare(`${b.investor_id}:${b.source_id ?? b.file_name}`)
);

await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Imported/copied ${copied} local vote files.`);
