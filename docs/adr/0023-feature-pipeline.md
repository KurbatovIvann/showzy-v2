# ADR-0023: Feature pipeline replaces SDD stages

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: owner

## Context

Blueprint §7 and `docs/pipeline.md` ran a six-stage SDD conveyor
(`/spec` → `/plan` → scaffold → `/implement` → `/review` → CI). Three of
those stages emit markdown. Agents optimized for that artifact: domain
specs grew to novels (`catalog.md` ~1500 lines) while `packages/modules/`
did not exist.

ADR-0008 already makes the action registry the single source of truth.
`defineActionContract`, Zod, `implementAction`, and the CI contract check
are the executable spec. The SDD layer duplicated that into `docs/specs/`
and treated the duplicate as authoritative.

The Encore lesson still holds: an agent on an empty framework invents
anti-patterns. It was misapplied. Patterns were locked in markdown instead
of in copyable TypeScript. Foundation packages are real; a golden backend
slice is not.

SDD was the right tool for designing a frozen runtime. It is the wrong
tool for shipping features on that runtime. Constitution (blueprint §2–§6,
accepted ADRs, prohibitions) and protocol manuals for frozen packages stay.

## Decision

Day-to-day work follows a four-role feature loop, not a markdown conveyor:

**Planner → Executor → Verifier → Guardian (optional).**

The unit of work is a **feature** (one user-visible capability with closed
acceptance). Planner output is a Linear feature card, a ticket graph, and
a tight context pack — not `docs/specs/<module>.md` or `docs/plans/<module>.md`.
When the API is contested, the reviewable spec is a contract-first
`*.contract.ts` PR. When the shape is obvious from the golden slice, one
implementation PR is enough.

The executable contract of a feature is the TypeScript descriptor
(`actions/*.contract.ts`) plus the tests required by the definition of
done. Do not open `docs/archive/` (ADR-0033).

Agents copy **per layer**. The first merged backend slice is the golden
API template (schema + read action + write/event if needed + tests). A
golden UI slice (one panel screen in `apps/mobile`) comes only after the
Experience Foundation UX gate. A feature may span API and UI as two
tickets; each ticket copies its own golden.

`/spec`, `/plan`, and `/rework-spec` are retired. Commands are `/feature`,
`/ticket` (Executor + verify loop), `/review` (Verifier), and `/guard`
(Guardian). A leaf `/ticket` still does not merge itself. ADR-0029 adds
an optional **parent orchestrator**: `/implement` (or `/ticket`) on a
feature parent launches isolated cloud executors, attaches independent
reviews from the parent conversation, and squash-merges children when
the conveyor merge gate is green. A human still closes the feature
parent.

## Alternatives considered

- **Keep SDD and slim Living novels** (spec-process-after-phase-0) —
  rejected: markdown remains the contract; agents still get paid to write
  novels. The Phase-0 retro treated the symptom.
- **Delete constitution and ADRs with the specs** — rejected: those are
  the irreversible architecture. Features must not relitigate them.
- **One golden module that includes API and UI** — rejected: agents copy
  files. A screen is a bad template for `implementAction`; a Drizzle
  schema is a bad template for Unistyles.
- **Generic library skills (Drizzle, Postgres, Nest-style architecture)
  as the quality harness** — rejected: they conflict with no-raw-SQL,
  explicit-no-magic, and module-index-only composition. Quality is
  fitness functions + golden TypeScript + hand-written Showzy skills
  extracted from that golden after it exists.

## Consequences

- Product intent lives in `docs/scope.md`, `docs/module-ownership.md`,
  Linear feature cards, and `*.contract.ts`. Archived domain specs stay
  in git for humans (`docs/archive/specs/`); agents must not open them
  unless a human names a file (ADR-0033).
- Protocol manuals (`docs/specs/core.md`, `db.md`, `contract.md`,
  `money.md`, `security-operations.md`, `companies-foundation.md`) stay
  next to the frozen packages they describe. They are not a `/spec` stage.
- The spec-ledger integrity test is retired with the Living/Active/Mixed
  conveyor.
- First domain work after this ADR is the golden backend slice, written
  by a strong model with a Guardian pass. Showzy pattern skills are
  extracted from that code, not from memory. Do not parallelize domain
  modules before it merges.
- Blueprint §7 and `docs/pipeline.md` describe this loop. ADR-0029
  records the autonomous parent conveyor. A further process change
  still needs a new ADR.
