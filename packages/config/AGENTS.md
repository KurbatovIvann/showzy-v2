# @showzy/config — Agent Instructions

Validated runtime environment (blueprint §5): one Zod schema over
`process.env`, parsed once at process boot. No other package may read
`process.env` directly — config flows in explicitly.

This package also owns the process log/Sentry redaction policy
(fnd-T28, security-operations §4–§6): `createProcessLogger`,
`redactUnknown` / `scrubTelemetryEvent`, and `createErrorTelemetry`.
Apps bind Sentry's SDK to those helpers; they never construct a raw
`pino()` logger.

## Usage

```ts
import { createProcessLogger, loadServerConfig } from "@showzy/config";

const config = loadServerConfig(); // throws ConfigValidationError → crash boot
const logger = createProcessLogger({ name: "api" });
```

- Call **once** at the process entrypoint (`apps/api`, `apps/worker`,
  scripts) and pass `config` (or slices of it) down as arguments. No
  module-level singleton, no lazy access.
- An invalid environment must crash the process before it serves anything.
  Never catch `ConfigValidationError` to "continue with defaults".

## Rules for changing this package

- **New env variable = three edits**: the Zod schema in `src/config.ts`, the
  grouped `ServerConfig` mapping, and `.env.example` (with a comment). Add
  the key to `SECRET_ENV_KEYS` when the value is a credential or can embed
  one (connection URLs, DSNs, tokens).
- **Secrets never appear in errors or logs.** `ConfigValidationError` names keys,
  not values; issues on `SECRET_ENV_KEYS` are redacted. The redaction test
  in `src/config.test.ts` guards env errors; `src/redact.test.ts` guards
  log/Sentry payloads. Extend both when adding secrets.
- Keep the schema limited to what running code consumes. Speculative
  variables are scope creep; the owning foundation/module task adds its own
  keys (e.g. fnd-T14 adds rate-limit knobs when it lands).
- The redaction walker (`src/redact.ts`) is the authority for logs and
  Sentry payloads. Representative secrets/OTP/PII tests live in
  `src/redact.test.ts` and `src/logger.test.ts` — extend them when adding
  a sensitive field name.
- Never log or serialize the whole config object; pass narrow slices.
- Empty-string values are treated as unset (templated `.env` ergonomics) —
  do not add "empty string means X" semantics.
