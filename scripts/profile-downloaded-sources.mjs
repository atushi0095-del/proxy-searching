import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, "data", "generated", "sources");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "download_manifest.json");
const OUT_FILE = path.join(ROOT, "data", "generated", "source_file_profiles.json");

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function inferInvestorFromName(fileName) {
  const match = fileName.match(/^\d+_([^_]+(?:_[^_]+)*)_(guideline|vote_result|vote_result_excel|reference)_/);
  return match?.[1] ?? "";
}

function profileWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { sheetRows: 200 });
  return {
    workbook_type: "xlsx",
    sheets: workbook.SheetNames.map((sheetName) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        blankrows: false,
        defval: ""
      });
      const headerCandidate = rows.find((row) => row.filter(Boolean).length >= 3) ?? [];
      return {
        sheet_name: sheetName,
        sampled_rows: rows.length,
        header_candidate: headerCandidate.slice(0, 20),
        first_rows: rows.slice(0, 5).map((row) => row.slice(0, 12))
      };
    })
  };
}

function profileFile(filePath, fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return profileWorkbook(filePath);
  }
  if (lower.endsWith(".pdf")) {
    return { workbook_type: "pdf", parse_status: "pending_pdf_text_extraction" };
  }
  if (lower.endsWith(".html") || lower.endsWith(".bin")) {
    return { workbook_type: "html_or_binary", parse_status: "pending_html_text_extraction" };
  }
  return { workbook_type: "unknown", parse_status: "pending" };
}

const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8").catch(() => "[]"));
const files = await readdir(SOURCES_DIR).catch(() => []);

const profiles = [];
for (const fileName of files) {
  const filePath = path.join(SOURCES_DIR, fileName);
  const fileStat = await stat(filePath);
  const manifestItem = manifest.find((item) => item.file_name === fileName);
  try {
    profiles.push({
      file_name: fileName,
      file_path: rel(filePath),
      investor_id: manifestItem?.investor_id ?? inferInvestorFromName(fileName),
      source_url: manifestItem?.url ?? "",
      kind: manifestItem?.kind ?? "",
      bytes: fileStat.size,
      profiled_at: new Date().toISOString(),
      ...profileFile(filePath, fileName)
    });
  } catch (error) {
    profiles.push({
      file_name: fileName,
      file_path: rel(filePath),
      investor_id: manifestItem?.investor_id ?? inferInvestorFromName(fileName),
      source_url: manifestItem?.url ?? "",
      kind: manifestItem?.kind ?? "",
      bytes: fileStat.size,
      profiled_at: new Date().toISOString(),
      parse_status: "error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

await writeFile(OUT_FILE, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
console.log(`Profiled ${profiles.length} downloaded source files`);
console.log(OUT_FILE);
