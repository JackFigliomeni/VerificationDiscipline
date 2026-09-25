import { readFileSync } from "node:fs";

const DELAY_MS = 300;
const LOW_TRUST_THRESHOLD = 1000;
const MAX_RETRIES = 3;

const COLOR = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDependencyNames(pkgPath) {
  let raw;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch (err) {
    console.error(`Could not read ${pkgPath}: ${err.message}`);
    process.exit(1);
  }

  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch (err) {
    console.error(`Could not parse ${pkgPath} as JSON: ${err.message}`);
    process.exit(1);
  }

  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  };
  return Object.keys(deps);
}

async function fetchWithRetry(url) {
  let res;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    res = await fetch(url);
    if (res.status !== 429) return res;
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await sleep(retryAfter * 1000);
  }
  return res;
}

async function getWeeklyDownloads(name) {
  const res = await fetchWithRetry(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.downloads ?? 0;
}

async function checkPackage(name) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (res.status !== 200) {
    return { name, status: "missing" };
  }

  await sleep(DELAY_MS);
  const downloads = await getWeeklyDownloads(name);
  if (downloads === null) {
    return { name, status: "unknown" };
  }
  const status = downloads < LOW_TRUST_THRESHOLD ? "low-trust" : "verified";
  return { name, status, downloads };
}

function printResult({ name, status, downloads }) {
  if (status === "verified") {
    console.log(`${COLOR.green}VERIFIED${COLOR.reset}    ${name}`);
  } else if (status === "low-trust") {
    console.log(`${COLOR.yellow}LOW-TRUST${COLOR.reset}   ${name}  (${downloads} weekly downloads)`);
  } else if (status === "unknown") {
    console.log(`${COLOR.cyan}UNKNOWN${COLOR.reset}     ${name}  (exists, but download count unavailable)`);
  } else {
    console.log(`${COLOR.red}MISSING${COLOR.reset}     ${name}`);
  }
}

async function main() {
  const pkgPath = process.argv[2] ?? "package.json";
  const names = loadDependencyNames(pkgPath);

  const results = [];
  for (const name of names) {
    results.push(await checkPackage(name));
    await sleep(DELAY_MS);
  }

  results.forEach(printResult);

  const verified = results.filter((r) => r.status === "verified").length;
  const lowTrust = results.filter((r) => r.status === "low-trust").length;
  const missing = results.filter((r) => r.status === "missing").length;
  const unknown = results.filter((r) => r.status === "unknown").length;

  const summary = [`${verified} verified`, `${lowTrust} low-trust`, `${missing} missing`];
  if (unknown > 0) summary.push(`${unknown} unknown`);
  console.log(`\n${summary.join(", ")}`);

  if (missing > 0) process.exit(1);
}

main();
