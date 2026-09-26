# package-hallucination-checker

A small CLI tool that verifies AI-suggested npm packages actually exist. It's the
reference implementation for the *Verification Discipline* paper: LLMs
occasionally invent plausible-sounding package names, and if you install
whatever they suggest without checking, you can end up depending on nothing
(or something malicious squatting on that name). This tool checks.

**Live demo:** https://package-hallucination-checker.vercel.app — paste in a
package.json and get a report back.

## What it does

Given a `package.json`, it:

1. Reads every entry in `dependencies`, `devDependencies`, `peerDependencies`,
   and `optionalDependencies`.
2. Looks each one up against the npm registry (`registry.npmjs.org`) to
   confirm it actually exists.
3. Pulls weekly download counts (`api.npmjs.org`) for anything that does
   exist, and flags packages under 1,000 weekly downloads as low-trust —
   these are the ones most likely to be a hallucinated name that happens to
   collide with something real, or a typosquat.
4. Prints a color-coded report and exits non-zero if anything is missing, so
   it can gate a commit or a CI step.

## Install / usage

No dependencies, no build step — just Node 18+.

```bash
node check.js               # checks ./package.json
node check.js path/to/other/package.json
```

## Example output

Run against a real project's `package.json` with one fake dependency
(`react-server-hooks-toolkit`) deliberately added to the list:

```
VERIFIED    @auth/prisma-adapter
VERIFIED    @prisma/client
VERIFIED    animejs
VERIFIED    bcryptjs
VERIFIED    next
VERIFIED    next-auth
VERIFIED    react
VERIFIED    react-dom
MISSING     react-server-hooks-toolkit
VERIFIED    @types/bcryptjs
VERIFIED    @types/node
VERIFIED    @types/react
VERIFIED    @types/react-dom
VERIFIED    autoprefixer
VERIFIED    eslint
VERIFIED    eslint-config-next
VERIFIED    postcss
VERIFIED    prisma
VERIFIED    tailwindcss
VERIFIED    tsx
VERIFIED    typescript

20 verified, 0 low-trust, 1 missing
```

(`MISSING` renders in red, `VERIFIED` in green in an actual terminal.) The
tool caught the hallucinated package immediately and exited with status 1.

## Pre-commit hook (optional)

To block commits that introduce a missing package, add this as
`.git/hooks/pre-commit` (git hooks aren't tracked by git itself, so this
step is manual per clone):

```bash
#!/bin/sh
node check.js
```

```bash
chmod +x .git/hooks/pre-commit
```

Tested by staging a fake dependency and attempting to commit — the hook's
non-zero exit code aborted the commit before it was created.

## Why this matters

This tool is the reference implementation for:

> Jack Figliomeni, "Verification Discipline: Catching and Correcting
> Hallucinations in AI Coding Agents: A Practical Framework" (2026)

See the paper for the full argument — the short version is that AI coding
assistants will occasionally suggest a package that doesn't exist, and the
failure mode isn't "the build breaks," it's "someone squats the name with
something malicious before you notice" (a technique the paper's sources call
"slop squatting"). This tool is the minimum viable check against that.
