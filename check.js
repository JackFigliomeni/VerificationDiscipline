import { readFileSync } from "node:fs";

const DELAY_MS = 250;
const LOW_TRUST_THRESHOLD = 1000;

const COLOR = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDependencyNames(pkgPath) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.keys(deps);
}

async function getWeeklyDownloads(name) {
  const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`);
  if (!res.ok) return 0;
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
  const status = downloads < LOW_TRUST_THRESHOLD ? "low-trust" : "verified";
  return { name, status, downloads };
}

function printResult({ name, status, downloads }) {
  if (status === "verified") {
    console.log(`${COLOR.green}VERIFIED${COLOR.reset}    ${name}`);
  } else if (status === "low-trust") {
    console.log(`${COLOR.yellow}LOW-TRUST${COLOR.reset}   ${name}  (${downloads} weekly downloads)`);
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

  console.log(`\n${verified} verified, ${lowTrust} low-trust, ${missing} missing`);

  if (missing > 0) process.exit(1);
}

main();
