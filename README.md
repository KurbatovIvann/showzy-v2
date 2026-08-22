# Showzy 2.0

AI-first SaaS platform for small business owners in Ukraine: product catalog
with dynamic pricing, chat-centric order flow, B2B document workflow with QES
signing, and bank/delivery integrations. A ground-up rewrite of Showzy v1,
built so AI agents write the features — 90–100% of the code is agent-written
under the constitution (blueprint + ADRs) and the feature loop (ADR-0023).

## Status

**Phase 0 foundation is on main** — action runtime, contract, API/worker, Expo shell.
**Phase 1 golden backend slices have merged** — price resolution, staff create/confirm, order-card projection.
**Mobile** has auth and the contract query runtime; product panel screens wait on the UX gate.

## Documents

| File                                     | Purpose                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`docs/blueprint.md`](docs/blueprint.md) | Architecture, stack, action registry, foundation invariants, feature pipeline |
| [`docs/scope.md`](docs/scope.md)         | MVP scope, deferred/dropped features, mobile-first roadmap                    |
| [`docs/adr/`](docs/adr/)                 | Architecture decision records                                                 |
| [`docs/pipeline.md`](docs/pipeline.md)   | Feature loop: Planner, Executor, Verifier, Guardian                           |
| [`docs/specs/`](docs/specs/)             | Protocol manuals for frozen foundation packages                               |
| [`docs/plans/`](docs/plans/)             | Pointer to archived phase-0 task graphs — new work is Linear feature cards    |
| [`docs/design/`](docs/design/)           | Experience Foundation process and UX artifacts                                |
| [`docs/archive/`](docs/archive/)         | Historical docs — not authority                                               |
| [`docs/reference/`](docs/reference/)     | Curated v1 reference: backend/DB audit, schema types, all 83 migrations       |
| [`AGENTS.md`](AGENTS.md)                 | Entry point for AI agents working in this repo                                |

## Local development

```bash
pnpm install
cp .env.example .env      # dev defaults match docker-compose.yml
docker compose up -d      # PostgreSQL 17 (pg_trgm/unaccent), Redis, Garage
pnpm --filter @showzy/db db:migrate   # apply Drizzle migrations
```

Runtime configuration is validated at boot by `packages/config` — an invalid
or incomplete `.env` fails fast with the offending keys named (secret values
are never echoed).

## Mobile (Expo)

Unistyles 3 requires a custom [development build](https://docs.expo.dev/develop/development-builds/introduction/)
(`expo-dev-client`). Expo Go will not load this app.

### Cloud build for a physical device

One-time: Expo account, then from `apps/mobile` log in. The EAS project id
lives in `app.config.ts` (`extra.eas.projectId`); EAS cannot write that
field into a dynamic config itself.

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

The `development` profile in `eas.json` is an internal development client.
When the build finishes, install the artifact from the Expo dashboard (QR /
install link) onto the device. iOS internal distribution needs an Apple
Developer account and registered devices.

### Local Metro (after the development build is installed)

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @showzy/api start
pnpm --filter @showzy/mobile start -- --dev-client
```

Open the installed **Showzy** app on the device (same Wi-Fi as the machine)
and connect to the bundler. `EXPO_PUBLIC_API_URL` is inlined by Metro at
bundle time — change it without a new native build. A phone cannot reach
`localhost` on your computer; use the machine's LAN address
(`http://192.168.x.x:3000`) in `apps/mobile/.env` when talking to a local
API. If device discovery fails, add `--tunnel`:

```bash
pnpm --filter @showzy/mobile start -- --dev-client --tunnel
```

## Stack (summary)

Node.js 22 + TypeScript strict · Hono + oRPC · PostgreSQL 17 + Drizzle ·
better-auth · BullMQ + Redis · Socket.IO · Zod v4 · Vercel AI SDK v6 ·
Expo (primary client) · Next.js (post-MVP) · Turborepo + pnpm.

See `docs/blueprint.md` §3 for the full table with rationale.
