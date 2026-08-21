# @showzy/mobile — Agent Instructions

Expo client (fnd-T48 shell, fnd-T49 auth). Primary V2 surface (ADR-0010).
Product screens are blocked by the Experience Foundation UX gate. Runtime is
Expo SDK 57.0.14 / React Native 0.86.2. Keep Unistyles on 3.2.2 (V1) and
Reanimated on 4.5.1 with worklets 0.10.1 — do not float Unistyles to 3.3
(worklets 0.11) or Reanimated to 4.5.0.

## Sources of truth

| Concern              | Source                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual language      | Unistyles `src/theme/` mapped from the Magic Patterns canvas ([`mp-to-mobile.md`](../../docs/design/mapping/mp-to-mobile.md))                                                |
| How to port a screen | Inventory the canvas → classify shared vs feature → reuse/create in `components/ui` or `components/screens` — [`mp-to-mobile.md`](../../docs/design/mapping/mp-to-mobile.md) |
| Domain behavior      | The Linear feature card, `@showzy/contract`, and the golden UI slice when it exists                                                                                          |
| Auth / sessions      | better-auth over `/api/auth` (ADR-0006, security-operations §2). Bearer in OS secure storage.                                                                                |

Figma is not a source of spacing, color, or components. Never modify the
V1 repository (`E:\showzy`). Do not paste Magic Patterns React/Tailwind
into this app.

## Layout

Every file is kebab-case; components export PascalCase names. One folder =
one role — do not mix transport, domain state, screens, UI kit, and copy in
the same directory.

- `src/app/` — expo-router routes **only**, each a one-line re-export of a
  screen component. Auth routes live in the `(auth)` group (V1 route
  composition). No logic in route files.
- `src/components/ui/` — **shared** primitives only (Button, Card, TextField,
  tabs, inputs, later Sheet / StatusPill / EmptyState). Never imports
  feature code; feature policy values (e.g. OTP length) arrive as props.
  Before adding a new file here, confirm the canvas piece is actually shared.
- `src/components/screens/<feature>/` — screen and **feature** components
  (OrderRow, editor sections). Take view models and callbacks; they do not
  own transport. Compose `components/ui`; do not duplicate button/card chrome.
- `src/auth/` — auth logic only, no screens: `http.ts` (better-auth HTTP
  client), `otp-flow.ts` (UI state machine), `session.ts` (token/session
  controller), `session-binding.ts` (UI notifications + revocation reset),
  `session-provider.tsx` (React context wiring), `use-otp-flow-state.ts`,
  `secure-storage.ts` / `storage.ts`, `errors.ts`, `identifiers.ts`,
  `policy.ts`. Tests cover the non-RN modules (`*.test.ts`).
- `src/prefs/` — device preferences (theme + last staff company selector).
  Native = MMKV (`platform-storage.native.ts`); web + tests = memory
  (`platform-storage.ts`). Never tokens, never the query cache.
- `src/i18n/` — `locale.ts` (detection + interpolation) plus one copy
  namespace per feature (`auth.ts`). uk/en, matching V1's namespace split.
  New features add a namespace here instead of a local `copy.ts`.
- `src/api/client.ts` — `createShowzyClient` wraps `createContractClient` with the env-driven API origin. `getAccessToken` comes from the session controller.
- `src/api/query-client.ts` / `query-options.ts` / `contract-mutation.ts` / `query-provider.tsx` — TanStack Query v5 runtime (SHO-102). Keys are `[actionName, companyId | null-company, input]`. Pass `useActiveCompany().activeCompanyId` into `contractQueryOptions` (and `getActiveCompany`) so a selector change re-renders keys. `useContractMutation` mints one `createMutationAttempt()` per submit. Do not persist the cache or add `@orpc/tanstack-query`. `query-platform.ts` is native-only (not imported from tests).
- `src/api/errors.ts` — `describeWireError` / `describeQueryFailure` discriminate on `error.code` / `kind`, never message text.
- `src/theme/tokens.ts` — palettes, spacing, radii, type, shadows, glass fallbacks. Pure TypeScript; no React Native imports.
- `src/theme/light.ts` / `dark.ts` — Unistyles theme objects.
- `src/theme/preference.ts` — `light` / `dark` / `system` resolution (default `light`, matching V1). Persisted via `src/prefs/` on native; web stays in-memory.
- `src/theme/unistyles.ts` — `StyleSheet.configure` only. Import from `index.ts` and `src/app/_layout.tsx` before any component. Do not import from tests.
- `metro.config.cjs` — NodeNext `.js` specifiers in workspace packages resolve to `.ts` so `@showzy/contract` can be bundled.

## Rules

- Client apps may import only `@showzy/contract`, `@showzy/validation`, and `@showzy/ui` (the latter two do not exist yet). Never `@showzy/core`, `@showzy/db`, or `@showzy/config`.
- Config is `EXPO_PUBLIC_API_URL` (Metro-inlined). Empty string is unset. Do not read `process.env` through `@showzy/config`.
- Bearer tokens live in `expo-secure-store` (iOS `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Web keeps them in memory so the export-smoke bundle does not persist them. Never log tokens or OTP codes. Classify auth HTTP failures by status, not message text.
- Auth is phone/email OTP only (ADR-0006). Google and guest browse are not in this slice.
- The signed-in company selector is a stub until `companies.listMine` (phase 2). The last selector is restored from device prefs after a **live** session hydrate only. An unsigned hydrate (dead token) clears the stored selector so the next sign-in cannot inherit another user's company. The selector is never an access grant (ADR-0013).
- Theme preference persists in MMKV on native (`src/prefs/`). Web and tests use the memory adapter — do not write tokens or the company selector to `localStorage`. Do not add a second storage native module. Tokens stay in SecureStore.
- Native modules for owner-first launch and near-term surfaces are preinstalled (see `package.json` + `app.config.ts` plugins) so product screens do not force a new Expo/dev-client binary. Unistyles 3 already requires a custom dev client (`expo-dev-client`); do not use Expo Go. Pin new Expo packages with `pnpm --filter @showzy/mobile exec expo install`.
- Icons: `lucide-react-native` (Magic Patterns canvas, ADR-0024). Do not add Ionicons, `@expo/vector-icons`, NativeWind, Google Sign-In, `expo-location`, `@callstack/liquid-glass`, or `@gorhom/bottom-sheet` (sheets are Reanimated; gorhom is unreliable on Reanimated 4.5).
- No Cursor skills are installed in phases 0–1 (`docs/pipeline.md`).
- Porting a canvas screen: follow the inventory → classify → reuse/create
  loop in [`mp-to-mobile.md`](../../docs/design/mapping/mp-to-mobile.md).
  Bind values to the theme (Class A/B). Product IA is Class C — canvas first.
