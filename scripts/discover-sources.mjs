import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "generated");
const OUT_FILE = path.join(OUT_DIR, "source_registry.json");
const TARGETS_FILE = path.join(ROOT, "data", "source_targets.json");
const POLICY_FILE = path.join(ROOT, "data", "collection_policy.json");

const fallbackTargets = [
  {
    investor_id: "blackrock",
    url: "https://www.blackrock.com/jp/individual/ja/about-us/important-information/voting",
    encoding: "utf-8",
  },
  {
    investor_id: "mufg_trust",
    url: "https://www.tr.mufg.jp/houjin/jutaku/about_stewardship.html",
    encoding: "shift_jis",
  },
];

async function loadTargets() {
  try {
    const raw = await readFile(TARGETS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackTargets;
  }
}

async function loadPolicy() {
  try {
    return JSON.parse(await readFile(POLICY_FILE, "utf8"));
  } catch {
    return {
      default_delay_ms: 2000,
      user_agent: "proxy-vote-pattern-app-research/0.1"
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function absolutize(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function classify(url, label) {
  const text = `${url} ${label}`;
  if (/xlsx|xls/i.test(url)) return "vote_result_excel";
  if (/koushikekka|kobetsu|行使結果|議決権行使結果|個別開示|行使状況|Disclosure|voting-results|report/i.test(text)) {
    return "vote_result";
  }
  if (/guideline|ガイドライン|方針|基準|判断基準|議決権行使基準|unyou_kabu|policy|standard/i.test(text)) {
    return "guideline";
  }
  return "reference";
}

function extractLinks(html, baseUrl, investorId) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1];
    const rawLabel = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const url = absolutize(baseUrl, href);
    if (!url) continue;
    if (!/(議決権|行使|ガイドライン|方針|基準|個別開示|行使結果|koushi|koushikekka|kobetsu|unyou_kabu|proxy|voting|vote|xlsx|xls|pdf)/i.test(`${url} ${rawLabel}`)) {
      continue;
    }
    links.push({
      investor_id: investorId,
      title: rawLabel || url,
      url,
      kind: classify(url, rawLabel),
      discovered_at: new Date().toISOString(),
    });
  }
  return links;
}

async function fetchHtml(target) {
  const res = await fetch(target.url, {
    headers: {
      "user-agent": policy.user_agent,
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`${target.url} returned ${res.status}`);
  const buffer = await res.arrayBuffer();
  return new TextDecoder(target.encoding ?? "utf-8").decode(buffer);
}

const targets = await loadTargets();
const policy = await loadPolicy();
const all = [];
for (const [index, target] of targets.entries()) {
  try {
    if (index > 0) await sleep(policy.default_delay_ms);
    const html = await fetchHtml(target);
    all.push(...extractLinks(html, target.url, target.investor_id));
  } catch (error) {
    console.warn(`Failed ${target.investor_id} ${target.url}: ${error instanceof Error ? error.message : error}`);
  }
}

const unique = [...new Map(all.map((item) => [`${item.investor_id}:${item.url}`, item])).values()];
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(unique, null, 2), "utf8");

console.log(`Discovered ${unique.length} source links from ${targets.length} target pages`);
console.log(OUT_FILE);
