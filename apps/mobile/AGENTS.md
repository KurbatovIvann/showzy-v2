# @showzy/mobile — Agent Instructions

Expo client (fnd-T48). This is the primary V2 surface (ADR-0010). Product
screens are blocked by the Experience Foundation UX gate; this package is
the technical shell, theme, and typed-client wiring only. Runtime is Expo
SDK 57.0.14 / React Native 0.86.2. Keep Unistyles on 3.2.2 (V1) and
Reanimated on 4.5.1 with worklets 0.10.1 — do not float Unistyles to 3.3
(worklets 0.11) or Reanimated to 4.5.0.

## Sources of truth

| Concern              | Source                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual language      | `src/theme/` transcribed from V1 `apps/mobile/src/theme` and [`docs/design/inventory/v1-mobile-token-baseline.md`](../../docs/design/inventory/v1-mobile-token-baseline.md) |
| How to port a screen | [`docs/design/mapping/v1-mobile-port-recipe.md`](../../docs/design/mapping/v1-mobile-port-recipe.md)                                                                        |
| Domain behavior      | The owning V2 spec and `@showzy/contract`                                                                                                                                   |

Figma is not a source of spacing, color, or components. Never modify the
V1 repository (`E:\showzy`).

## Layout

- `src/theme/tokens.ts` — palettes, spacing, radii, type, shadows, glass fallbacks. Pure TypeScript; no React Native imports.
- `src/theme/light.ts` / `dark.ts` — Unistyles theme objects.
- `src/theme/preference.ts` — `light` / `dark` / `system` resolution (default `light`, matching V1).
- `src/theme/unistyles.ts` — `StyleSheet.configure` only. Import from `index.ts` and `src/app/_layout.tsx` before any component. Do not import from tests.
- `src/api/client.ts` — `createShowzyClient` wraps `createContractClient` with the env-driven API origin.
- `src/api/errors.ts` — example of discriminating `isWireError` by `code`, never by message text.
- `src/app/` — expo-router routes. No product navigation.

## Rules

- Client apps may import only `@showzy/contract`, `@showzy/validation`, and `@showzy/ui` (the latter two do not exist yet). Never `@showzy/core`, `@showzy/db`, or `@showzy/config`.
- Config is `EXPO_PUBLIC_API_URL` (Metro-inlined). Empty string is unset. Do not read `process.env` through `@showzy/config`.
- Bearer tokens stay out of this package until fnd-T49 (secure storage). The client accepts a `getAccessToken` provider; the shell passes `() => null`.
- Theme persistence across launches (V1 MMKV) is deferred so this slice does not add another native module. Preference still switches in-process (`createMemoryThemeStore`).
- No Cursor skills are installed in phases 0–1 (`docs/pipeline.md`).
- Discretion from the port recipe: improve craft and accessibility, not the product.
