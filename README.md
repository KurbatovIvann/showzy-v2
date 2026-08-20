# Showzy 2.0

AI-first SaaS platform for small business owners in Ukraine: product catalog
with dynamic pricing, chat-centric order flow, B2B document workflow with QES
signing, and bank/delivery integrations. A ground-up rewrite of Showzy v1,
built so AI agents write the features — 90–100% of the code is agent-written
under the constitution (blueprint + ADRs) and the feature loop (ADR-0023).

## Status

**Phase 0 — foundation** (in progress) plus parallel **Experience Foundation**.
No application code yet; the repository currently contains the architecture
documents, agent rules, design process, and v1 reference materials.

## Documents

| File                                     | Purpose                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`docs/blueprint.md`](docs/blueprint.md) | Architecture, stack, action registry, foundation invariants, feature pipeline |
| [`docs/scope.md`](docs/scope.md)         | MVP scope, deferred/dropped features, mobile-first roadmap                    |
| [`docs/adr/`](docs/adr/)                 | Architecture decision records                                                 |
| [`docs/pipeline.md`](docs/pipeline.md)   | Feature loop: Planner, Executor, Verifier, Guardian                           |
| [`docs/specs/`](docs/specs/)             | Protocol manuals for frozen foundation packages                               |
| [`docs/plans/`](docs/plans/)             | Historical task breakdowns — new work is Linear feature cards                 |
| [`docs/design/`](docs/design/)           | Experience Foundation process and UX artifacts                                |
| [`docs/archive/`](docs/archive/)         | Historical docs — not authority                                               |
| [`docs/reference/`](docs/reference/)     | Curated v1 reference: backend/DB audit, schema types, all 83 migrations       |
| [`AGENTS.md`](AGENTS.md)                 | Entry point for AI agents working in this repo                                |

## Local development

```bash
pnpm install
cp .env.example .env      # dev defaults match docker-compose.yml
docker compose up -d      # PostgreSQL 17 (pg_trgm/unaccent), Redis, MinIO
pnpm --filter @showzy/db db:migrate   # apply Drizzle migrations
```

Runtime configuration is validated at boot by `packages/config` — an invalid
or incomplete `.env` fails fast with the offending keys named (secret values
are never echoed).

## Stack (summary)

Node.js 22 + TypeScript strict · Hono + oRPC · PostgreSQL 17 + Drizzle ·
better-auth · BullMQ + Redis · Socket.IO · Zod v4 · Vercel AI SDK v6 ·
Expo (primary client) · Next.js (post-MVP) · Turborepo + pnpm.

See `docs/blueprint.md` §3 for the full table with rationale.
