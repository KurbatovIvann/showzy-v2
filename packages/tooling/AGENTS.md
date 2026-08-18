# @showzy/tooling — Agent Instructions

Shared tooling presets consumed by every package in the monorepo. No runtime
code lives here — only configuration.

## Exports

| Subpath                              | What                                                  | How to consume                                                                                          |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@showzy/tooling/tsconfig/base.json` | Strict tsconfig base (Node 22, NodeNext, `noEmit`)    | `"extends": "@showzy/tooling/tsconfig/base.json"` in the package `tsconfig.json`; set `include` locally |
| `@showzy/tooling/prettier`           | Prettier config (defaults, no overrides)              | Root `prettier.config.mjs` re-exports it; packages don't need their own                                 |
| `@showzy/tooling/eslint`             | `showzyEslintConfig({ tsconfigRootDir })` flat preset | `eslint.config.mjs`: `export default showzyEslintConfig({ tsconfigRootDir: import.meta.dirname })`      |

## Rules for changing this package

- Changes here affect **every** package: they always get full human review.
- The ESLint preset encodes prohibitions (`no-explicit-any`, suppression
  comments require a linked `SHO-<n>` issue, no `as unknown as`) — never
  weaken these without an accepted ADR.
- `boundaries/elements` is the single source for the architectural element
  map (blueprint §5). The allowed-dependency matrix is `boundaries/dependencies`
  (v7 successor of `element-types`) plus `showzy/import-boundaries` for
  specifier rules that cannot depend on pnpm resolving workspace packages:
  `*.contract.ts` allowlist, own-schema (ADR-0014), module index-only
  cross-imports, `packages/contract` → `index.contract.ts` only, client apps
  → `@showzy/contract` + validation/ui. The contract-client layer currently
  permits any non-`@showzy` npm package (today: `zod`, `@orpc/*`). Tighten
  to an explicit external allowlist when that set grows — do not add
  ad-hoc boundary rules in individual packages.
- Prettier stays at defaults; style debates are settled by "whatever
  Prettier does".
- Emitting builds (`declaration`, bundler-specific options) are per-package
  concerns: packages that build override the base's `noEmit` locally.
