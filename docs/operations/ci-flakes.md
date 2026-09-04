# CI flakes

> Standing rule for [SHO-145](https://linear.app/showzy-v2/issue/SHO-145)
> (parent [SHO-142](https://linear.app/showzy-v2/issue/SHO-142)). Agent-facing
> copy lives in `AGENTS.md`.

A red Vitest on a file this PR did not intend to change is either an
infra flake or a real regression. It is not a signal to retrigger.

## Forbidden

- Empty retrigger commits (`git commit --allow-empty`, whitespace-only
  no-ops, or any other commit whose only purpose is to re-run CI).
- Vitest `retry` on a test, `describe`, or file.
- GitHub Actions `retry` / rerun-on-failure on `.github/workflows/ci.yml`
  jobs. That workflow must stay retry-free.

Those tactics hide the difference between a test bug and a product
regression. In an agentic workflow the agent cannot tell them apart.

## `dependency-audit` npm registry timeouts (SHO-387)

pnpm 10 called npm's retired `/-/npm/v1/security/audits/quick` endpoint.
That surface hung (`ERR_SOCKET_TIMEOUT`) and later returns 410. pnpm 12
(`packageManager` in the root `package.json`) uses
`/-/npm/v1/security/advisories/bulk` instead.

The `dependency-audit` job still runs
`packages/tooling/ci/run-dependency-audit.mjs` → `pnpm audit --audit-level
high`. The wrapper re-invokes that command only on classified transient
registry errors. Advisory findings fail the gate on the first report. Do
not pass `--ignore-registry-errors`, and do not add GitHub Actions job
`retry` / rerun-on-failure. Do not pass `--fetch-retries` /
`--fetch-timeout` to `pnpm audit` (those are not audit flags).

## What to do instead

1. Treat the failure as a bug until proven otherwise.
2. Open or reuse a Linear issue with the `flake` label (team Showzy-v2).
   Point at the failing file, the workflow run, and the parent work if
   known.
3. Fix the race, isolation, or leftover-state bug on its own ticket.
   Do not skip, quarantine, or weaken the test to go green.

## Known files until SHO-142 children land

Until the clock and visibility children of SHO-142 are on `main`, these
files have confirmed races. A red check on them is still a `flake`
ticket, not a retrigger:

- `packages/core/src/testing/kit.db.test.ts` — isolation-suite rate-limit
  race against a live token-bucket clock (SHO-146 freezes the suite
  clock).
- `apps/worker/src/jobs.db.test.ts` — Garage leftover-staging
  `HeadObject` visibility (SHO-143).
- `packages/modules/files/src/actions/files.db.test.ts` — same Garage
  leftover-staging race (SHO-143).
