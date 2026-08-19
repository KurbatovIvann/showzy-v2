# @showzy/mobile — Agent Instructions

Expo client (fnd-T48 shell, fnd-T49 auth). Primary V2 surface (ADR-0010).
Product screens are blocked by the Experience Foundation UX gate. Runtime is
Expo SDK 57.0.14 / React Native 0.86.2. Keep Unistyles on 3.2.2 (V1) and
Reanimated on 4.5.1 with worklets 0.10.1 — do not float Unistyles to 3.3
(worklets 0.11) or Reanimated to 4.5.0.

## Sources of truth

| Concern              | Source                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual language      | `src/theme/` transcribed from V1 `apps/mobile/src/theme` and [`docs/design/inventory/v1-mobile-token-baseline.md`](../../docs/design/inventory/v1-mobile-token-baseline.md) |
| How to port a screen | [`docs/design/mapping/v1-mobile-port-recipe.md`](../../docs/design/mapping/v1-mobile-port-recipe.md)                                                                        |
| Domain behavior      | The owning V2 spec and `@showzy/contract`                                                                                                                                   |
| Auth / sessions      | better-auth over `/api/auth` (ADR-0006, security-operations §2). Bearer in OS secure storage.                                                                               |

Figma is not a source of spacing, color, or components. Never modify the
V1 repository (`E:\showzy`).

## Layout

- `src/theme/tokens.ts` — palettes, spacing, radii, type, shadows, glass fallbacks. Pure TypeScript; no React Native imports.
- `src/theme/light.ts` / `dark.ts` — Unistyles theme objects.
- `src/theme/preference.ts` — `light` / `dark` / `system` resolution (default `light`, matching V1).
- `src/theme/unistyles.ts` — `StyleSheet.configure` only. Import from `index.ts` and `src/app/_layout.tsx` before any component. Do not import from tests.
- `src/api/client.ts` — `createShowzyClient` wraps `createContractClient` with the env-driven API origin. `getAccessToken` comes from the session controller.
- `src/api/errors.ts` — example of discriminating `isWireError` by `code`, never by message text.
- `src/auth/` — OTP sign-in, secure token store, session hydrate/refresh/sign-out. Tests cover the non-RN modules (`*.test.ts`).
- `src/app/` — expo-router routes: sign-in, verify, signed-in session stub. No product navigation.
- `metro.config.cjs` — NodeNext `.js` specifiers in workspace packages resolve to `.ts` so `@showzy/contract` can be bundled.

## Rules

- Client apps may import only `@showzy/contract`, `@showzy/validation`, and `@showzy/ui` (the latter two do not exist yet). Never `@showzy/core`, `@showzy/db`, or `@showzy/config`.
- Config is `EXPO_PUBLIC_API_URL` (Metro-inlined). Empty string is unset. Do not read `process.env` through `@showzy/config`.
- Bearer tokens live in `expo-secure-store` (iOS `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Web keeps them in memory so the export-smoke bundle does not persist them. Never log tokens or OTP codes. Classify auth HTTP failures by status, not message text.
- Auth is phone/email OTP only (ADR-0006). Google and guest browse are not in this slice.
- The signed-in company selector is a stub until `companies.listMine` (phase 2). The selector is never an access grant (ADR-0013).
- Theme persistence across launches (V1 MMKV) is deferred so auth is the only extra native module in this slice. Preference still switches in-process (`createMemoryThemeStore`).
- No Cursor skills are installed in phases 0–1 (`docs/pipeline.md`).
- Discretion from the port recipe: improve craft and accessibility, not the product.
