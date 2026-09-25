import { readFileSync } from "node:fs";

const DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDependencyNames(pkgPath) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.keys(deps);
}

async function checkPackage(name) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  return { name, exists: res.status === 200 };
}

async function main() {
  const pkgPath = process.argv[2] ?? "package.json";
  const names = loadDependencyNames(pkgPath);

  const results = [];
  for (const name of names) {
    results.push(await checkPackage(name));
    await sleep(DELAY_MS);
  }

  for (const { name, exists } of results) {
    console.log(`${exists ? "PASS" : "FAIL"}  ${name}`);
  }
}

main();
