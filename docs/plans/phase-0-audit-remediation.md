# Phase-0 exit-gate audit — remediation plan

> Status: **proposed for owner review at fnd-G1** (SHO-56), 2026-08-18.
> Produced by a full audit of the merged phase-0 scaffold (fnd-T1…fnd-T28)
> against `docs/specs/core.md`, `docs/specs/db.md`, `docs/specs/contract.md`,
> `docs/specs/security-operations.md`, `docs/specs/companies-foundation.md`,
> ADR-0012…0016 / 0018 / 0020 / 0021, `.cursor/rules/*`, and
> `docs/plans/foundation.md`.

## 1. Audit verdict

The foundation is in strong shape. Everything below was verified directly
on the current `main`:

- **CI is green end-to-end, locally and on GitHub**: format check, `tsc`,
  ESLint boundaries, Vitest (674 tests across 66 files, including the
  Testcontainers PG 17 integration projects), the contract-check stage, auth
  schema reproducibility, migration drift + money lint + grant tests, backup
  verify dry-run, bundle probe, and OpenAPI drift — all pass.
- **Foundation tables match db.md §4 column-by-column**; roles/grants
  (`showzy_app` append-only `audit_log`, no DDL) are enforced and tested;
  raw SQL appears only as commented, spec-approved primitives.
- **The execution pipeline implements core.md §4 in the exact step order**,
  with real tests for rollback atomicity, output-validation
  `CoreInvariantError`, read-only transactions, TOCTOU re-authorization,
  deadline/abort, idempotency races, confirmation binding/single-use,
  per-aggregate event ordering under concurrency, retry/dead-letter/replay,
  `ctx.call` / `ctx.callAtomic` rules, and the six principal factories.
- **No `any` / `as unknown as` / ts-suppressions, no raw-SQL violations, no
  stray `throw new Error` in domain code** (test-kit assertion helpers and
  two internal guards excepted — see A11/A12), `.env` is not committed, no
  secrets in code, and the client-safe contract leaf reaches no Node/DB
  code (probe + `types: []` tsconfigs verified).
- The blueprint §2.1 invariant run (fnd-T22), the §12 suite-coverage
  enforcement, and the fixture module all exist and pass.

The audit found **no critical tenant-isolation or money-correctness defect**.
It did find two gate-blocking gaps (one process, one architectural leftover),
six MAJOR code/test gaps, and a tail of MINOR hygiene items. They are broken
into the sequential tasks below. Tasks follow the standing rules: one task =
one branch = one PR, tests required per `definition-of-done.mdc`, ~300 diff
lines is the comfort guideline.

## 2. Gate-blocking findings (fix before or at fnd-G1)

### A1 — Branch protection cannot be enabled on the current GitHub plan

**Severity: blocker (process) — RESOLVED as accepted risk (owner,
2026-08-18).** `docs/operations/branch-protection.md` instructs enabling a
ruleset, and blueprint §7.1(6) / security-operations §7 ("merging without
green CI is impossible") assume it works — but the repository is a
**private repo on a personal free plan**, where GitHub returns
`403 "Upgrade to GitHub Pro or make this repository public to enable this
feature."` Every CI gate is currently advisory: a red PR or a direct push
to `main` merges freely.

**Owner decision:** no upgrade to Pro and no switch to public for now. The
constraint and the compensating process are recorded in the "Plan
prerequisite" section of `docs/operations/branch-protection.md` (this
audit's PR): the owner is the only merge gate, all seven CI checks are
treated as manually mandatory, no direct pushes to `main` by convention,
and the ruleset is enabled immediately if the repository ever moves to
Pro/an organization/public.

### A2 — The interim composition root in `packages/core` was never retired

**Severity: blocker (architecture/process) — implemented (SHO-82).**
The CI contract-check stage is `pnpm --filter @showzy/api contract:check`
and walks `apps/api/src/composition.ts`. `runContractCheck` stays in core
as a library; `registered-modules.ts` / `ci-stage.test.ts` are deleted.
Module tasks register in the API composition root — never in
`packages/core`.

**Original finding (kept for the audit trail):** The CI contract-check
stage (`pnpm --filter @showzy/core contract:check`) walked
`packages/core/src/contract-check/registered-modules.ts`, which was the
**explicitly empty interim manifest**. Its own header comment said fnd-T23/
fnd-T26 become "the real composition roots — at that point the stage walks
those instead and this file is retired". fnd-T23 and fnd-T26 were merged;
the file was not retired. Consequences:

- The CI contract-check stage currently validates an **empty registry** —
  the §2 rule matrix is exercised only by core's own unit tests.
- When the first module lands (fnd-T29+), it must register in
  `registered-modules.ts` to be covered by the CI stage — but that file is
  inside `packages/core`, which `prohibitions.mdc` freezes for module
  tasks. If a module task skips it, the contract check silently stays
  vacuous (including the §12 `suiteCoverage` omission rule, which only
  fires for registered actions).
- The fnd-G1 demo — "add an action from the fixture template → green CI
  **without touching `packages/core`**" — is therefore not executable in a
  meaningful way today: CI goes green either by editing frozen core files
  or by leaving the new action entirely outside the contract check.

**Instructions (one scaffold PR, sensitive — tenant/runtime protocol
enforcement):**

1. Create a composition root outside core. Recommended: `apps/api`
   (`src/composition.ts`), because it is the only place that already
   imports both barrels of every module (contracts + implementations) and
   builds the boot `ActionRegistry`. Export a
   `buildContractCheckInput(): ContractCheckInput` that assembles the
   registry, event definitions, subscriptions, declared call edges, the
   `projectionGrants` manifest re-exported from `@showzy/db`, read-model
   grants/schema imports, and the aggregated `suiteCoverage` contributed by
   each module (each module exports its coverage declaration next to its
   barrels; the composition root merges them).
2. Move the CI stage: `contract-check` job runs
   `pnpm --filter @showzy/api contract:check`, a vitest (or plain node)
   entry that imports the composition and asserts
   `runContractCheck(...).ok`. `runContractCheck` itself stays in core as a
   library.
3. Use `apps/api/src/boot.ts` from the same composition module so the boot
   registry and the checked registry can never diverge (today `boot.ts`
   creates an empty `new ActionRegistry()` inline).
4. Delete `packages/core/src/contract-check/registered-modules.ts` and
   `ci-stage.test.ts` (replaced by the api-side stage); keep
   `contract-check.ts` + its rule tests in core untouched.
5. Update `packages/core/AGENTS.md`, `packages/contract/AGENTS.md`
   ("Adding a module's client actions" — remove any step that edits core),
   and `.github/workflows/ci.yml`.
6. **Prove the gate demo**: on a throwaway branch, add one action copied
   from the fixture template as a real `packages/modules/<name>` package,
   register it only in the new composition root + `contractModules`, run
   full CI green, then discard the branch. Record the result in the PR
   description — this is the fnd-G1 demo artifact.

**Tests first:** a composition test proving an action registered at boot
but absent from `suiteCoverage` fails the api-side contract-check stage;
the boot/CI registry identity test (step 3).

## 3. MAJOR findings (strongly recommended before fnd-G1 sign-off)

### A3 — The pipeline is fail-open when protocol hooks are not composed

**Severity: MAJOR (core) — implemented.** `packages/core/src/runtime/pipeline/types.ts`
declares every hook slot optional and `execute-action.ts` skips silently:
rate limit (`deps.hooks?.rateLimit?.enforce`, line ~308), idempotency
(`deps.hooks?.idempotency !== undefined`, ~368), audit
(`deps.hooks?.audit !== undefined`, ~438/~517). Only confirmation fails
closed. The "absent hook = slice not landed" escape hatch made sense
mid-scaffold; since fnd-T20 all four hooks exist, so a composition bug now
silently executes idempotent mutations without key checks, audited writes
without audit rows, and everything unthrottled — violating core.md §5/§8/§10,
which are not conditional on composition.

**Instructions (one scaffold PR, sensitive):**

1. Enforce at execution time (cheapest, keeps `PipelineDeps` shape):
   throw `CoreInvariantError` when `contract.idempotent && risk !== "read"`
   and no idempotency hook; when `contract.audit === true` and no audit
   hook; when the action is not `system`-principal and no rate-limit hook
   is composed. Mirror the existing confirmation check.
2. Keep hooks optional in the type (the test kit composes subsets
   deliberately), but the kit must now compose what its fixture actions
   declare — extend `packages/core/src/testing/kit.ts` with an in-memory
   rate-limit store (this is also needed by A4).
3. Update `packages/core/AGENTS.md` (the "absent hook" paragraph).

**Tests first:** one test per protocol proving a composition missing that
hook fails with `CoreInvariantError` instead of executing the action.

### A4 — Inherited test-kit suites do not verify everything §12/§13 promise

**Severity: MAJOR (core/testing) — implemented.** Module authors inherit weaker
guarantees than core itself has:

- `atomicCallSuite` (`protocol-suites.ts`) asserts only commit/rollback of
  the two effect counters. core.md §12 requires it to also prove rollback
  removes **events** and that **undeclared, tenant/principal-mismatch, and
  nested atomic calls fail**. Core's own `ctx-call-atomic.db.test.ts`
  covers these for the fixture edge, but modules instantiating the suite
  for *their* edges get none of it.
- `consumerIsolationSuite` has no rate-limit assertion (§13: 60/min/user).
- `accountIsolationSuite` checks null `company_id` only on the finish log
  line — not in emitted events or the audit row — and has no 90/min/user
  assertion (§13). `publicProjectionSuite` already proves the pattern
  (it asserts the 30/min IP-HMAC limit).

**Instructions (one scaffold PR):**

1. Extend `AtomicCallCase` with rejection probes (undeclared edge,
   principal/tenant mismatch, nested atomic call) and assert
   `domain_events` is empty after rollback.
2. Add an in-memory rate-limit store to the kit pipeline (shared with A3)
   and assert the 61st consumer call / 91st account call in the window
   fails with `RateLimitError`.
3. Extend `runAccountIsolationCase` to inspect `domain_events.company_id`
   and `audit_log.company_id` for the action's rows (null required).
4. Keep suite self-tests (`kit.db.test.ts`, `protocol-suites.db.test.ts`)
   proving each new assertion fails on a seeded violation.

### A5 — `ProjectionReadTx` allows a foreign-table read through join methods

**Severity: MAJOR (db, tenant boundary) — implemented.**
`packages/db/src/capabilities.ts` returns `GrantedSelect` as a dynamic
Drizzle `PgSelect`, which still carries `leftJoin` / `innerJoin` /
`rightJoin` / `fullJoin`. Audit probe confirmed:
`projection.from("discoveryCompanies").leftJoin(auditLog, …)` **compiles
and executes** — a public-global handler can pull a non-granted table into
its query (an existence/filter oracle at minimum). db.md §10 requires
"`ProjectionReadTx` cannot compile or execute writes/**foreign-table
reads**". Writes are blocked by the read-only transaction; the join surface
is the hole, and ESLint deliberately allows the `search` module (the future
holder of public-global actions) to import foreign schemas.

**Instructions (one scaffold PR, sensitive):**

1. Narrow the builder: return a wrapper (or `Pick`) exposing only
   `where` / `orderBy` / `limit` / `offset` / `groupBy` / `having` and the
   awaitable/execute surface — analogous to how `ReadTx` is constructed.
2. Add a compile-level test
   (`expectTypeOf(...).not.toHaveProperty("leftJoin")`, and the other three
   join methods) plus a runtime probe test beside the existing
   `capabilities.test.ts` cases.

### A6 — The money schema lint misses money columns outside its keyword list

**Severity: MAJOR (db/CI) — implemented.** `packages/db/scripts/check-money-schema.mjs`
recognizes money only by the term list
`price|amount|total|subtotal|discount|tax|fee|balance`. Verified misses:
`numeric("refunded_minor")`, `integer("deposit_minor")`, and
`doublePrecision("payout_value")` all pass. `refunded_minor` is already
declared in payments.md §2 (Active) and lands in fnd-T45 — a wrong typing
would sail through CI today.

**Instructions (one scaffold PR):**

1. Treat any column whose SQL name ends `_minor` (and `_milli`) as
   integer-typed money/quantity: require the `bigint` constructor, and
   `_minor` additionally requires a table `currency` column.
2. Flag every `numeric(` / `doublePrecision(` / `real(` column in
   `src/schema` unless explicitly allowlisted in the script with a comment.
3. Extend the term list (`refunded`, `payout`, `deposit`, `cost`).
4. Extend `schema-checks.test.ts` fixtures for each new rejection class.

### A7 — The 20/h-per-IP OTP send limit is config-asserted, never behavior-tested

**Severity: MAJOR (api/security) — implemented.** security-operations §8 requires OTP
"send/**IP limits**" to be integration-tested. Expiry, attempt cap,
cooldown, and 5/h/identifier have behavioral tests; the per-IP limit is
only asserted as config shape (`options.test.ts`), and its enforcement
lives entirely inside better-auth's rate-limit storage path — the one §2
parameter that could silently regress on a dependency upgrade.

**Instructions (one scaffold PR, sensitive — auth):**

1. Add an integration test in `apps/api/src/http/app.db.test.ts`: from a
   trusted-proxy peer with one fixed forwarded IP, send OTPs to 20 distinct
   phone numbers (advancing the injected clock past per-identifier
   cooldowns); assert the 21st send → 429. Add a companion test proving a
   different forwarded IP still succeeds (the limiter keys off the
   sanitized forwarded IP, not the proxy peer).
2. While in the file: add the missing `/api/v1` staff-action-without-session
   → 401 test (the gate is mounted on both handlers but only `/rpc` is
   tested), and a brief comment on the `Date.now` monkey-patch in the
   expiry test explaining why it exists.

### A8 — 401 is outside the typed wire-error union

**Severity: MAJOR (contract + spec patch) — implemented.** contract.md §4 promises "a
discriminated union typed by wire code — no string matching", but the table
has no authentication row: `apps/api/src/http/app.ts` throws
`ORPCError("UNAUTHORIZED", { status: 401 })`, which `isWireError()` rejects
— so the most common auth failure forces clients into exactly the ad-hoc
string matching the spec forbids.

**Instructions (one scaffold PR; contract.md is Living — amend in the same
PR):**

1. Patch contract.md §4 with an `UNAUTHENTICATED` / 401 row (transport-level:
   no session where one is required).
2. Add the row to `wireErrorDefinitions` + the `WireError` union in
   `packages/contract/src/client/wire-errors.ts`; the api session gate
   throws the defined code; keep 401 vs 403 semantics (401 = no session,
   403 = core `PermissionDeniedError`).
3. Update the union-narrowing test and the `app.db.test.ts` assertions to
   narrow via `isWireError` instead of raw strings.

## 4. MINOR findings — code (batchable, after the gate)

Group into three small PRs by area; none blocks fnd-G1.

### A9 — Worker robustness (one PR)

**Implemented (2026-08-19)** on `scaffold/phase-0-a9-a11`.

- `apps/worker/src/index.ts`: `shutdown()` has no re-entrancy latch — a
  second SIGINT/SIGTERM during drain calls `close()` twice
  (`pool.end()` throws, unhandled rejection). Latch a `closing` flag,
  catch/log close errors, and flush Sentry before exit.
- `apps/worker/src/listen.ts`: a dropped LISTEN connection never
  reconnects and emits only one error line, so the documented
  "poll-only > 5 min" SEV2 alert (`docs/operations/alerts.md`) has no
  drivable signal. Either reconnect with backoff (log recovery) or emit a
  periodic "outbox listen down, poll-only" heartbeat while degraded.

### A10 — Config/ops hygiene (one PR)

**Implemented (2026-08-19)** on `scaffold/phase-0-a9-a11`.

- Add a test that parses the real `.env.example` and asserts its key set
  equals the `envSchema` key set (today parity is convention-only).
- Rewrite `packages/db/scripts/backup-verify.mjs` as a thin argv shim over
  the tested TS module `src/ops/backup-verify.ts` (Node 22 strip-types, as
  `apps/worker` already does). This removes the duplicated policy lines,
  the weaker single-replace connection-string redaction (a password
  containing `:` partially leaks), and the untested `--restore-smoke`
  branch that currently logs binary `pg_dump` output (use
  `--file /dev/null`). Reuse `packages/config` userinfo redaction.
- `.github/CODEOWNERS`: add entries for
  `/packages/db/src/schema/foundation.ts`, `/packages/db/src/schema/auth.ts`,
  and `/packages/db/migrations/` (db.md §10 "CODEOWNERS covers each file").
- Add `CREATE EXTENSION IF NOT EXISTS pg_trgm / unaccent` as an approved
  raw-SQL migration (comment referencing db.md §3/§7). Today the extensions
  exist only in the compose init, so Testcontainers/production databases
  diverge and the first `search` GIN-trigram migration would fail in CI.
- `docs/operations/alerts.md`: reword the "`--restore-smoke` red in a
  scheduled job" row to "planned at launch" (no such scheduled job exists),
  or add the scheduled workflow.

### A11 — Core/runtime polish (one PR)

**Implemented (2026-08-19)** on `scaffold/phase-0-a9-a11` (ActionCtx unique-symbol branding skipped — owner's call).

- Replace the untyped guards with `CoreInvariantError`:
  `events/uuidv7.ts` (`RangeError`), `audit/canonical-json.ts`
  (`TypeError` ×3).
- `audit/create-audit-hook.ts`: replace the unchecked
  `env.ctx.actor.type as "user" | "system"` cast with an explicit narrow
  that throws `CoreInvariantError` on `anonymous`.
- Make `IdempotencyHook.probe` required in `pipeline/types.ts` (an
  absent probe silently burns a confirmation challenge on replay).
- Optional (owner's call): brand `ActionCtx` with a factory-assigned
  `unique symbol` so hand-rolled contexts fail the type checker (§3
  "nothing ad-hoc"); today only ESLint/convention protects this.
- `apps/api/src/http/client-ip.ts`: hoist the per-request `BlockList`
  construction to app construction (static config, hot path).
- `apps/api/src/auth/otp-send-guard.ts`: make the cooldown check atomic
  (Lua/`INCR`) — the documented read-modify-write race is closable cheaply
  since Redis is already mounted.

## 5. MINOR findings — spec/doc alignment (one PR)

All target Living specs (or Active db.md via the same-PR-patch rule with a
proving test where behavior is asserted):

1. **db.md §4**: record the `event_deliveries.event_id → domain_events.id
   ON DELETE RESTRICT` FK that the schema actually has (defensible, but a
   structural addition to a frozen table must live in the spec, not only a
   code comment) — or drop the FK.
2. **db.md §8**: "factories for foundation rows" do not exist as exports —
   the core kit produces foundation rows through the runtime protocols.
   Patch the sentence (or export the three row builders currently private
   to `foundation.test.ts`).
3. **db.md §4**: one sentence recording that generated auth tables keep
   upstream `$onUpdate` semantics (no DB trigger) and upstream camelCase
   index names — a deliberate convention exception.
4. **db.md §9 / foundation.md**: record explicitly that the local dev
   fixture seed (company/staff/customer/products) is deferred until the
   catalog schema exists (fnd-T29+); today only `role_permission_defaults`
   is seeded and the deferral is implied, not stated.
5. **core.md §4**: the start log line cannot carry actor/company (identity
   is unknown pre-authentication); patch the wording so the identity fields
   ride the finish line.
6. **core.md §10**: system actions are hardcoded fail-open on rate-limit
   store failure; the spec says they "define their policy in the spec".
   Either add a per-contract override or record the fail-open default.
7. **core.md §12**: `runSocialDesiredStateCase` is exported kit API but
   spec-invisible; add it to §12 (or move it out of the public export).
8. **core.md §8**: decide and record whether `audit: true` failures *before
   input validation* are exempt from audit rows (current behavior) — today
   the spec is silent.
9. **contract.md §3/§7**: the client has no automatic retry layer; key
   reuse is manual via `attempt.options`. Patch the wording ("retries of a
   logical submit reuse the key") or note that a retry helper is owed.
10. **contract.md §7 note**: when the first `ctx.callAtomic` edge lands,
    add the composition fixture proving the callee is absent from
    router/OpenAPI/AI artifacts (enforcement exists; the fixture is owed).
11. **security-operations §4 / API AGENTS**: `channel` is hardcoded `"ui"`
    for all transport invocations including `/api/v1` REST aliases; record
    the phase-0 decision and the trigger to revisit (external consumers /
    AI mount).
12. **tooling note**: the ESLint contract-client allowlist permits any
    non-`@showzy` npm package into client-safe files; consider an explicit
    external allowlist (`zod`, `@orpc/*`) when the dependency set grows.

## 6. Suggested execution order

| Order | Task | Owner | Blocking |
| --- | --- | --- | --- |
| 1 | A1 branch protection — resolved as accepted risk; note recorded in `docs/operations/branch-protection.md` | human | done |
| 2 | A2 composition root retirement + gate demo | scaffold agent | done (SHO-82) |
| 3 | A3 fail-closed pipeline hooks | scaffold agent | done (`scaffold/phase-0-a3-a8`) |
| 4 | A4 test-kit suite completeness | scaffold agent | done (`scaffold/phase-0-a3-a8`) |
| 5 | A5 ProjectionReadTx join escape | scaffold agent | done (`scaffold/phase-0-a3-a8`) |
| 6 | A6 money lint hardening | scaffold agent | done (`scaffold/phase-0-a3-a8`) |
| 7 | A7 OTP per-IP integration test | scaffold agent | done (`scaffold/phase-0-a3-a8`) |
| 8 | A8 typed 401 wire error | scaffold agent | done (`scaffold/phase-0-a3-a8`) |
| 9–11 | A9 / A10 / A11 code polish batches | scaffold agent | none |
| 12 | A12 spec/doc alignment batch (§5) | scaffold agent + owner | none |

A3–A8 are order-independent among themselves (still one PR at a time, per
pipeline.md §3). A5 and A6 protect milestones F/H entry; doing them inside
the gate window keeps the reference slices from inheriting the gaps.

## 7. Changelog

| Date | Change | Why |
| --- | --- | --- |
| 2026-08-19 | A9–A11 implemented: worker shutdown latch + LISTEN reconnect/heartbeat; `.env.example` key-set test; backup-verify TS shim + colon-safe redaction + null-device dump; CODEOWNERS for foundation/auth/migrations; `pg_trgm`/`unaccent` migration; alerts.md restore-smoke planned at launch; CoreInvariantError for uuidv7/canonical-json/anonymous audit; required idempotency `probe`; hoisted trusted-proxy BlockList; atomic OTP send | fnd-G1 minor hygiene (phase-0 audit) |
| 2026-08-18 | A3–A8 implemented on `scaffold/phase-0-a3-a8`: fail-closed protocol hooks, inherited kit suites, ProjectionReadTx join lock, money lint, OTP per-IP test, `UNAUTHENTICATED` 401 | fnd-G1 MAJOR findings; owner asked for one branch covering A3–A8 |
| 2026-08-18 | A2 implemented (SHO-82): contract-check CI stage walks `apps/api/src/composition.ts`; core interim manifest retired | fnd-G1 gate: module tasks must not edit frozen core to be covered |
| 2026-08-18 | A1 resolved as accepted risk: owner keeps the private/free plan; compensating manual merge gate recorded in `docs/operations/branch-protection.md` | Owner decision at gate review |
| 2026-08-18 | Initial audit report and remediation breakdown | fnd-G1 phase-0 exit-gate audit (SHO-56) |
