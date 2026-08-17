# @showzy/config — Agent Instructions

Validated runtime environment (blueprint §5): one Zod schema over
`process.env`, parsed once at process boot. No other package may read
`process.env` directly — config flows in explicitly.

## Usage

```ts
import { loadServerConfig } from "@showzy/config";

const config = loadServerConfig(); // throws ConfigValidationError → crash boot
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
- **Secrets never appear in errors.** `ConfigValidationError` names keys,
  not values; issues on `SECRET_ENV_KEYS` are redacted. The redaction test
  in `src/config.test.ts` guards this — extend it when adding secrets.
- Keep the schema limited to what running code consumes. Speculative
  variables are scope creep; the owning foundation/module task adds its own
  keys (e.g. fnd-T14 adds rate-limit knobs when it lands).
- Never log or serialize the whole config object; pass narrow slices.
- Empty-string values are treated as unset (templated `.env` ergonomics) —
  do not add "empty string means X" semantics.
