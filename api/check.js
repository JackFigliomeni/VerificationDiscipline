import { extractDependencyNames, checkDependencies, summarize, describeResult } from "../lib/checker.js";

const MAX_DEPENDENCIES = 120;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST with a package.json body" });
    return;
  }

  let pkg;
  try {
    pkg = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Body is not valid JSON" });
    return;
  }

  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    res.status(400).json({ error: "Body must be a package.json object" });
    return;
  }

  let names;
  try {
    names = extractDependencyNames(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (names.length > MAX_DEPENDENCIES) {
    res.status(400).json({ error: `Too many dependencies (${names.length}); max is ${MAX_DEPENDENCIES}` });
    return;
  }

  let results;
  try {
    results = await checkDependencies(names);
  } catch (err) {
    res.status(502).json({ error: `Failed to reach the npm registry: ${err.message}` });
    return;
  }

  const annotated = results.map((r) => ({ ...r, ...describeResult(r) }));
  const summary = summarize(results);
  const status = summary.missing > 0 ? 422 : 200;
  res.status(status).json({ results: annotated, summary });
}
