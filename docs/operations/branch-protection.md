# Branch protection for `main`

> Owned by fnd-T2 (`docs/archive/plans/foundation.md`). The settings below are
> **enabled by the human owner** in GitHub — repository
> `KurbatovIvann/showzy-v2` → Settings → Rules → Rulesets (preferred over
> classic branch protection). CI job names come from
> `.github/workflows/ci.yml` and are stable identifiers.

Blueprint §7.1(6): "Merging is impossible without green CI — branch
protection." Pipeline stage 6 (VERIFICATION) is a hard gate before any
parallel implementation.

## Plan prerequisite — NOT currently enforceable (accepted risk)

> Recorded at the fnd-G1 audit (owner decision, 2026-08-18).

GitHub does not offer rulesets or classic branch protection on **private
repositories under a personal free plan** — the API returns
`403 "Upgrade to GitHub Pro or make this repository public to enable this
feature."` The owner has decided not to upgrade to Pro and not to make the
repository public for now, so the ruleset below **cannot be enabled** and
every CI gate is technically advisory: a red PR or a direct push to `main`
is not blocked by GitHub.

Compensating process until the constraint is lifted:

- **The human owner is the merge gate.** Nothing merges into `main` except
  through a PR that the owner has reviewed, and only with all seven CI
  checks green — treated as manually mandatory.
- **No direct pushes to `main`** by convention; every change goes through a
  branch + PR, including the owner's own.
- Agents must never merge PRs (already a standing rule) and must report a
  red check instead of working around it.
- **No empty CI retriggers.** A red Vitest is a flake or a regression —
  open a `flake` Linear issue. Never push `--allow-empty`, Vitest
  `retry`, or Actions rerun-on-failure
  (`docs/operations/ci-flakes.md`, SHO-145).

Revisit triggers: the repository moves to GitHub Pro, into an organization,
or becomes public — then enable the ruleset below immediately and run the
verification steps.

## Required ruleset (target branch: `main`)

1. **Require a pull request before merging** — direct pushes to `main` are
   blocked for everyone, including the owner.
   - Required approvals: **1** (the human owner; every scaffold PR gets full
     human review per pipeline.md §3).
   - Require review from Code Owners: enable once a CODEOWNERS file exists
     (arrives with fnd-T7).
2. **Require status checks to pass** with **"Require branches to be up to
   date before merging"** enabled. Required checks (exact job names):
   - `checks` — fail-closed aggregator over format, typecheck, lint, test,
     build-smoke, and the other required jobs below (SHO-334). The job name
     is the stable branch-protection check; workers report independently.
   - `secret-scan` — gitleaks
   - `dependency-audit` — pnpm audit over the committed lockfile
   - `contract-check` — action/event contract check (fnd-T10)
   - `migration-drift` — schema regeneration + money lint + grants (fnd-T5/T6)
     plus backup-verify `--dry-run` (fnd-T28)
   - `bundle-probe` — client bundle probe + OpenAPI drift (fnd-T25)
   - `e2e-smoke` — Playwright smoke against the built `apps/web` bundle
     (SHO-331). Auth/RPC are intercepted in the browser; no production
     credentials. Maestro mobile e2e remains a later phase (fnd-T51).
3. **Require conversation resolution before merging.**
4. **Block force pushes** and **restrict deletions** on `main`.
5. **No bypass actors.** The gate applies to administrators too
   (security-operations §7: CI gates cannot be bypassed by ordinary PRs;
   an owner bypass would defeat the merge gate the whole pipeline relies on).

## Verification after enabling

- A direct push to `main` is rejected.
- A PR with a failing check (see the fnd-T2 meta-verification throwaway
  branch) cannot be merged.
- The merge button stays disabled until all seven checks report success.

## Dependency review — current choice and switch path

This repository is **private and user-owned**, so GitHub's
`actions/dependency-review-action` is unavailable (it requires a public
repository or an organization-owned repository with GitHub Code
Security/Advanced Security). The `dependency-audit` job therefore gates on
`pnpm audit --audit-level high` against the committed lockfile.

If the repository ever becomes public or moves into an organization with
Code Security, replace the `dependency-audit` job body with
`actions/dependency-review-action` (diff-aware: scans only dependencies
introduced by the PR) and keep the job name unchanged so the required-checks
list stays valid.

Complementary repository settings to enable now (Settings → Advanced
Security): **Dependency graph** and **Dependabot alerts** — both are free on
private repositories and cover advisories published between PRs.

## Secret scanning — current choice

`secret-scan` runs [gitleaks](https://github.com/gitleaks/gitleaks-action)
v3 (SHA-pinned) over the full commit history. No license key is required for
personal-account repositories (`GITLEAKS_LICENSE` only applies to
organizations). GitHub's native push-protection secret scanning is also free
for user-owned private repos and worth enabling in Settings as a second
layer, but the gitleaks job is the gate CI enforces.
