# @showzy/api — Agent Instructions

HTTP transport composition (fnd-T26): the Hono app, better-auth instance,
session resolution, principal dispatch, and the oRPC / OpenAPI mounts.
Auth policy parameters still live in `src/auth/` (fnd-T6).

## Layout

- `src/index.ts` — process entry. Calls `loadServerConfig()` once, boots,
  listens. An invalid environment crashes before anything serves.
- `src/boot.ts` — opens Postgres + Redis, builds better-auth through
  `buildAuthOptions`, composes the action pipeline, returns `createApp`.
- `src/http/app.ts` — `createApp(composition)`: request-id, trusted-proxy
  IP, better-auth at `/api/auth`, oRPC at `/rpc`, OpenAPI REST at `/api/v1`,
  `GET /health`. Dependencies are injected; tests never read `process.env`.
- `src/http/client-ip.ts` — forwarded-IP headers are trusted only when the
  TCP peer is in `TRUSTED_PROXIES`. Spoofed `X-Forwarded-For` is ignored.
- `src/pipeline.ts` — fills every protocol hook slot (audit, idempotency,
  rate limit, confirmation).
- `src/stores/redis.ts` — Redis secondary storage (`GETDEL`), confirmation
  store, and the Lua token-bucket rate-limit store. Tests that do not need
  Redis use the in-memory stores from `@showzy/core` and `stores/memory.ts`.
- `src/auth/` — `buildAuthOptions` (fnd-T6). Every better-auth instance
  still goes through this factory.

## Auth schema generation

`packages/db/src/schema/auth.ts` is generated — never hand-edit it:

```
pnpm --filter @showzy/api auth:generate   # regenerate after changing plugins
pnpm --filter @showzy/api auth:check      # CI: regenerate + fail on diff
```

## Rules

- Every better-auth instance goes through `buildAuthOptions`. Never call
  `betterAuth()` with an inline options object.
- Config comes from `@showzy/config` at the entrypoint; this package never
  reads `process.env` except inside `loadServerConfig`.
- OTP codes never reach logs, error messages, or audit records.
- OTP send/verify responses stay identical for existing and unknown
  identifiers (non-enumeration). Tests pin this over HTTP.
- The 401 gate is this package's job: authenticated principals without a
  session never reach `executeAction` (core's `PermissionDeniedError` is
  defense in depth, 403).
- Selectors (`x-company-id`) are never authority. Consumer/account/public
  dispatch ignores them. Staff membership is verified by core.
- Residual accepted risk: phone OTP codes are plaintext inside the TTL'd
  secondary store for their 5-minute lifetime (the phone plugin has no
  `storeOTP`; they never reach Postgres) — see docs/plans/foundation.md
  "Reported deviations" before touching the phone plugin config.
