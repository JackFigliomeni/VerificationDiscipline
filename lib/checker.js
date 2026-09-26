const DELAY_MS = 300;
const LOW_TRUST_THRESHOLD = 1000;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractDependencyNames(pkg) {
  if (!isPlainObject(pkg)) {
    throw new Error("package.json must be a JSON object");
  }

  const sectionNames = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const names = new Set();
  for (const sectionName of sectionNames) {
    const section = pkg[sectionName];
    if (section === undefined) continue;
    if (!isPlainObject(section)) {
      throw new Error(`"${sectionName}" must be an object, got ${Array.isArray(section) ? "an array" : typeof section}`);
    }
    for (const name of Object.keys(section)) names.add(name);
  }
  return [...names];
}

function parseRetryAfterMs(header) {
  if (!header) return 1000;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(dateMs - Date.now(), 0);
  return 1000;
}

async function fetchWithRetry(url) {
  let res;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    res = await fetch(url);
    if (res.status !== 429) return res;
    if (attempt < MAX_RETRIES - 1) {
      await sleep(parseRetryAfterMs(res.headers.get("retry-after")));
    }
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
  const res = await fetchWithRetry(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (res.status === 404) {
    return { name, status: "missing" };
  }
  if (!res.ok) {
    return { name, status: "unknown" };
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

const LABEL_BY_STATUS = {
  verified: "VERIFIED",
  "low-trust": "LOW-TRUST",
  unknown: "UNKNOWN",
  missing: "MISSING",
};

export function describeResult(result) {
  const label = LABEL_BY_STATUS[result.status];
  let detail = "";
  if (result.status === "low-trust") detail = `${result.downloads} weekly downloads`;
  else if (result.status === "unknown") detail = "exists, but download count unavailable";
  return { label, detail };
}

export function formatSummary(summary) {
  const { verified, lowTrust, missing, unknown } = summary;
  const parts = [`${verified} verified`, `${lowTrust} low-trust`, `${missing} missing`];
  if (unknown > 0) parts.push(`${unknown} unknown`);
  return parts.join(", ");
}
