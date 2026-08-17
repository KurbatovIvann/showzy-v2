# @showzy/api — Agent Instructions

HTTP transport composition. The current slice (fnd-T6) is only the
better-auth configuration module; the Hono server, session resolution, and
principal dispatch land with fnd-T26 and must build on what is here.

## Layout

- `src/auth/policy.ts` — the security-operations §2 parameters (OTP expiry,
  attempt/send limits, cookie attributes) as named constants. The single
  source: options factory and guard consume them, tests assert against
  them. Values change only through spec rework.
- `src/auth/options.ts` — `buildAuthOptions(composition)`, the one factory
  every better-auth instance (runtime, CLI generation, tests) goes through
  so parameters cannot drift between them. Dependencies (database adapter,
  OTP senders, send-limit store, clock) are injected via the
  `AuthComposition` argument — never constructed inside.
- `src/auth/otp-send-guard.ts` — per-identifier send limits (60-s resend
  cooldown, 5 sends/h per phone/email). better-auth's own rate limiter is
  IP-keyed only; the guard runs as a `hooks.before` middleware ahead of OTP
  creation. Backed by any `SecondaryStorage`-shaped store (Redis in
  fnd-T26, in-memory map in tests).
- `src/auth/cli.ts` — CLI-only instance for schema generation. Its
  connection string and secret are inert placeholders; nothing in it ever
  executes.

## Auth schema generation

`packages/db/src/schema/auth.ts` is generated — never hand-edit it:

```
pnpm --filter @showzy/api auth:generate   # regenerate after changing plugins
pnpm --filter @showzy/api auth:check      # CI: regenerate + fail on diff
```

After regeneration run `pnpm --filter @showzy/db db:generate` and review the
migration. CI runs `auth:check` in the migration-drift job, so a plugin
change that alters the schema cannot merge without the regenerated file and
its migration.

## Rules

- Every better-auth instance goes through `buildAuthOptions`. Never call
  `betterAuth()` with an inline options object.
- Config comes from `@showzy/config` at the entrypoint (fnd-T26); this
  package never reads `process.env`.
- OTP codes never reach logs, error messages, or audit records.
- OTP send/verify responses stay identical for existing and unknown
  identifiers (non-enumeration, security-operations §2). Tests pin this.
- Known deviation: phone OTPs are stored plaintext at rest (upstream plugin
  limitation; email OTPs are hashed) — see docs/plans/foundation.md
  "Reported deviations" before touching the phone plugin config.
