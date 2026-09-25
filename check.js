import { readFileSync } from "node:fs";
import { extractDependencyNames, checkDependencies, summarize } from "./lib/checker.js";

const COLOR = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

function loadPackageJson(pkgPath) {
  let raw;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch (err) {
    console.error(`Could not read ${pkgPath}: ${err.message}`);
    process.exit(1);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Could not parse ${pkgPath} as JSON: ${err.message}`);
    process.exit(1);
  }
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
  const pkg = loadPackageJson(pkgPath);
  const names = extractDependencyNames(pkg);

  const results = await checkDependencies(names);
  results.forEach(printResult);

  const { verified, lowTrust, missing, unknown } = summarize(results);
  const summary = [`${verified} verified`, `${lowTrust} low-trust`, `${missing} missing`];
  if (unknown > 0) summary.push(`${unknown} unknown`);
  console.log(`\n${summary.join(", ")}`);

  if (missing > 0) process.exit(1);
}

main();
