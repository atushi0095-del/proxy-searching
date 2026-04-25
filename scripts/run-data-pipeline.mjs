import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "data", "generated", "pipeline_logs");

const steps = [
  {
    name: "sync-company-universe",
    script: "scripts/sync-company-universe.mjs",
    args: []
  },
  {
    name: "discover-sources",
    script: "scripts/discover-sources.mjs",
    args: []
  },
  {
    name: "seed-source-registry",
    script: "scripts/seed-source-registry.mjs",
    args: []
  },
  {
    name: "download-sources",
    script: "scripts/download-sources.mjs",
    args: ["guideline", "vote_result_excel", "--limit=180"]
  },
  {
    name: "profile-downloaded-sources",
    script: "scripts/profile-downloaded-sources.mjs",
    args: []
  },
  {
    name: "analyze-mufg-votes",
    script: "scripts/analyze-mufg-vote-excel.mjs",
    args: []
  },
  {
    name: "analyze-nomura-votes",
    script: "scripts/analyze-nomura-vote-excel.mjs",
    args: []
  },
  {
    name: "analyze-resona-votes",
    script: "scripts/analyze-resona-vote-excel.mjs",
    args: []
  },
  {
    name: "analyze-daiwa-votes",
    script: "scripts/analyze-daiwa-vote-excel.mjs",
    args: []
  }
];

async function runStep(step) {
  const startedAt = new Date().toISOString();
  const originalArgv = process.argv;
  process.argv = [process.execPath, path.join(ROOT, step.script), ...step.args];
  try {
    const scriptUrl = pathToFileURL(path.join(ROOT, step.script)).href;
    await import(`${scriptUrl}?run=${Date.now()}`);
    return {
      name: step.name,
      script: step.script,
      args: step.args,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "OK"
    };
  } catch (error) {
    return {
      name: step.name,
      script: step.script,
      args: step.args,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "ERROR",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    process.argv = originalArgv;
  }
}

await mkdir(LOG_DIR, { recursive: true });

const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  const result = await runStep(step);
  results.push(result);
  if (result.status === "ERROR") {
    console.error(result.error);
    break;
  }
}

const logFile = path.join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(logFile, `${JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2)}\n`, "utf8");

const failed = results.find((result) => result.status === "ERROR");
if (failed) {
  console.error(`Pipeline stopped at: ${failed.name}`);
  process.exit(1);
}

console.log(`Pipeline completed. Log: ${path.relative(ROOT, logFile)}`);
