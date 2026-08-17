# Showzy 2.0

AI-first SaaS platform for small business owners in Ukraine: product catalog
with dynamic pricing, chat-centric order flow, B2B document workflow with QES
signing, and bank/delivery integrations. A ground-up rewrite of Showzy v1,
built with Specification-Driven Development — 90–100% of the code is written
by AI agents.

## Status

**Phase 0 — foundation** (in progress) plus parallel **Experience Foundation**.
No application code yet; the repository currently contains the architecture
documents, agent rules, design process, and v1 reference materials.

## Documents

| File | Purpose |
| --- | --- |
| [`docs/blueprint.md`](docs/blueprint.md) | Architecture, stack, action registry, foundation invariants, SDD pipeline |
| [`docs/scope.md`](docs/scope.md) | MVP scope, deferred/dropped features, mobile-first roadmap |
| [`docs/adr/`](docs/adr/) | Architecture decision records (17 accepted) |
| [`docs/pipeline.md`](docs/pipeline.md) | Agent pipeline operations manual: stages, models, commands |
| [`docs/specs/`](docs/specs/) | Per-module specifications (contracts for implementing agents) |
| [`docs/plans/`](docs/plans/) | Mutable task breakdowns; Linear tickets are created from these |
| [`docs/design/`](docs/design/) | Experience Foundation process and UX artifacts |
| [`docs/reference/`](docs/reference/) | Curated v1 reference: backend/DB audit, schema types, all 83 migrations |
| [`AGENTS.md`](AGENTS.md) | Entry point for AI agents working in this repo |

## Stack (summary)

Node.js 22 + TypeScript strict · Hono + oRPC · PostgreSQL 17 + Drizzle ·
better-auth · BullMQ + Redis · Socket.IO · Zod v4 · Vercel AI SDK v6 ·
Expo (primary client) · Next.js (post-MVP) · Turborepo + pnpm.

See `docs/blueprint.md` §3 for the full table with rationale.
