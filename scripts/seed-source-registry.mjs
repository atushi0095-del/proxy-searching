import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const REGISTRY_FILE = path.join(GENERATED_DIR, "source_registry.json");
const GUIDELINE_SOURCES_FILE = path.join(ROOT, "data", "guideline_sources.json");

function classify(source) {
  if (/xlsx|xls/i.test(source.url)) return "vote_result_excel";
  if (source.document_type === "vote_result") return "vote_result";
  if (source.document_type === "guideline" || source.document_type === "guideline_changes") return "guideline";
  return "reference";
}

async function readJsonOr(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

const existing = await readJsonOr(REGISTRY_FILE, []);
const sources = await readJsonOr(GUIDELINE_SOURCES_FILE, []);

const seeded = sources.map((source) => ({
  investor_id: source.investor_id,
  title: source.title,
  url: source.url,
  kind: classify(source),
  source_id: source.source_id,
  language: source.language,
  source_document_type: source.document_type,
  discovered_at: new Date().toISOString(),
  discovery_method: "guideline_sources"
}));

const merged = [...new Map([...existing, ...seeded].map((item) => [`${item.investor_id}:${item.url}`, item])).values()];

await mkdir(GENERATED_DIR, { recursive: true });
await writeFile(REGISTRY_FILE, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

console.log(`Seeded source registry with ${seeded.length} known official sources`);
console.log(`Registry now has ${merged.length} unique sources`);
