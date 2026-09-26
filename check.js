import { readFileSync } from "node:fs";
import { extractDependencyNames, checkDependencies, summarize, describeResult, formatSummary } from "./lib/checker.js";

const COLOR = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

const COLOR_BY_STATUS = {
  verified: COLOR.green,
  "low-trust": COLOR.yellow,
  unknown: COLOR.cyan,
  missing: COLOR.red,
};

function sanitizeForTerminal(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1f\x7f]/g, "");
}

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

function printResult(result) {
  const { label, detail } = describeResult(result);
  const color = COLOR_BY_STATUS[result.status];
  const name = sanitizeForTerminal(result.name);
  const suffix = detail ? `  (${detail})` : "";
  console.log(`${color}${label.padEnd(10)}${COLOR.reset}${name}${suffix}`);
}

async function main() {
  const pkgPath = process.argv[2] ?? "package.json";
  const pkg = loadPackageJson(pkgPath);

  let names;
  try {
    names = extractDependencyNames(pkg);
  } catch (err) {
    console.error(`Invalid ${pkgPath}: ${err.message}`);
    process.exit(1);
  }

  const results = await checkDependencies(names);
  results.forEach(printResult);

  const summary = summarize(results);
  console.log(`\n${formatSummary(summary)}`);

  if (summary.missing > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`Failed to check dependencies: ${err.message}`);
  process.exit(1);
});
