import { extractDependencyNames, checkDependencies, summarize } from "../lib/checker.js";

const MAX_DEPENDENCIES = 200;

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

  if (!pkg || typeof pkg !== "object") {
    res.status(400).json({ error: "Body must be a package.json object" });
    return;
  }

  const names = extractDependencyNames(pkg);
  if (names.length > MAX_DEPENDENCIES) {
    res.status(400).json({ error: `Too many dependencies (${names.length}); max is ${MAX_DEPENDENCIES}` });
    return;
  }

  const results = await checkDependencies(names);
  const summary = summarize(results);

  res.status(200).json({ results, summary });
}
