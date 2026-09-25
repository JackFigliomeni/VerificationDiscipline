const DELAY_MS = 300;
const LOW_TRUST_THRESHOLD = 1000;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractDependencyNames(pkg) {
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

export async function checkPackage(name) {
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

export async function checkDependencies(names) {
  const results = [];
  for (const name of names) {
    results.push(await checkPackage(name));
    await sleep(DELAY_MS);
  }
  return results;
}

export function summarize(results) {
  const verified = results.filter((r) => r.status === "verified").length;
  const lowTrust = results.filter((r) => r.status === "low-trust").length;
  const missing = results.filter((r) => r.status === "missing").length;
  const unknown = results.filter((r) => r.status === "unknown").length;
  return { verified, lowTrust, missing, unknown };
}
