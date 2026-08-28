# Magic Patterns → Expo port map

> Status: Owner-approved operating rule, 2026-08-20.
> Authority: [ADR-0024](../../adr/0024-magic-patterns-canonical-ux.md).
> Canvas: [Showzy V2 prototype](https://www.magicpatterns.com/c/g4fsekajwwkeex3v612gvp).

The canvas is the approved design. The design system is Expo Unistyles
(`apps/mobile/src/theme/` + `apps/mobile/src/components/ui/`). Never paste
prototype React/Tailwind into the app. Do not maintain a Magic Patterns
design-system preset.

V1 files under `E:\showzy` stay read-only domain reference. They are not
visual acceptance.

## Screen workflow (mandatory)

When work starts on a canvas screen, do this **before writing screen JSX**:

1. **Read the canvas files** for that route (page + the components it
   imports). List every visual piece: chrome, controls, rows, sheets,
   empty/loading/error, copy.
2. **Classify each piece:**

   | Kind | Lives in | Examples |
   | --- | --- | --- |
   | **Shared primitive** | `apps/mobile/src/components/ui/` | Button, Card, TextField, SegmentedTabs, OtpInput, Banner, EmptyState, StatusPill, AppHeader, Sheet |
   | **Feature component** | `apps/mobile/src/features/<module>/<surface>/` (golden: `catalog/products`). Unmigrated screens stay under `components/screens/<feature>/` until their own tickets. | OrderRow, ProductImagePicker, AssistantSheet, editor sections |
   | **Route only** | `apps/mobile/src/app/` | one-line re-export |

   Shared means: reused on more than one product surface, or it is a
   generic control (button, field, card, tabs, input, sheet, badge,
   empty state, header). Feature means: it knows an order, a product, a
   customer, or a specific flow.

3. **Reuse or create**
   - Shared and already in `components/ui` → restyle/extend that primitive
     with theme tokens. Do not fork a second Button.
   - Shared and missing → add it under `components/ui` in the same PR as
     the first screen that needs it. Bind every value to the theme.
   - Feature → new file under `src/features/<module>/<surface>/` (copy
     `catalog/products`). It may compose shared primitives; it must not
     duplicate their chrome. Do not add new product modules under
     `components/screens/`.
4. **Wire the screen** to a contract view-model and callbacks. Replace
   mock data. Drop Google / demo-mode (ADR-0006).
5. If the canvas introduces a **new token** (hex, radius, type size), add
   it to `src/theme/tokens.ts` and to the tables below in the same PR.
   Do not hardcode hex in a screen.

If the screen is not on the canvas, stop and design it in Magic Patterns
first.

## Discard (never port)

- Vite / `index.html` / `package.json` / Tailwind as runtime
- `canvas.manifest.js`, `useScreenInit.js`, `data-id` props
- `react-router-dom` → expo-router
- `framer-motion` → Reanimated
- `lucide-react` → `lucide-react-native` (needs `react-native-svg`, already in the native kit)
- `sonner` → app toast primitive once it exists
- mock `contexts/` and `data/` → `@showzy/contract`
- Google sign-in and “demo mode”
- hover-only affordances; use `pressed` / `active`
- the 430px phone chrome; the real app is full-screen

## Tokens (in `apps/mobile/src/theme/tokens.ts`)

Light values come from the canvas `tailwind.config.js`. Dark is the same
roles, not a second product.

### Color

| Role | Canvas | Light Unistyles | Dark Unistyles |
| --- | --- | --- | --- |
| Page | `canvas` `#F7F6F2` | `colors.background` | `#161410` |
| Card / sheet | `surface` `#FFFFFF` | `colors.card` / `popover` | `#211F1A` |
| Ink / primary fill | `ink` `#1C1C1A` | `colors.primary` / `foreground` | inverted fill `#EDEBE6` |
| Muted text | `muted` `#6E6A61` | `colors.mutedForeground` | `#9B968B` |
| Faint text | `faint` `#9B968B` | `colors.icon.muted` | `#7A7570` |
| Track / hairline | `line` `#E5E2DA` | `colors.border` / `input` / `muted` | `#322F2A` |
| Field fill | `bg-canvas` | `colors.inputFill` | `#1C1A17` |
| Action / AI / focus | `action` `#2F6FED` | `colors.accent` / `ring` | `#5B8FFF` |
| Action soft | `actionSoft` `#E8F0FF` | `colors.accentSoft` | `#1A2744` |
| Success | `success` `#237A4B` | `colors.success` | `#3D9A64` |
| Success soft | `successSoft` `#E6F2EA` | `colors.successSoft` | `#1A2E24` |
| Attention | `attention` `#A65A16` | `colors.warning` | `#D4893A` |
| Attention soft | `attentionSoft` `#FBEFE1` | `colors.warningSoft` | `#2E2418` |
| Danger | `danger` `#C0392B` | `colors.destructive` | `#D45B4F` |
| Danger soft | `dangerSoft` `#FBEAE7` | `colors.destructiveSoft` | `#2E1C1A` |
| Sheet dim | `bg-ink/35` | `colors.overlay` | `rgba(0,0,0,0.45)` |

Primary **buttons are ink**, not action blue. Action blue is AI, focus
rings, “changed” chips, and selected-filter badges.

Status must never be color-only: always a label.

### Type, space, radius, hit

System font. No webfont.

| Use | Canvas | Unistyles |
| --- | --- | --- |
| Field label | 13 medium muted | `typography.xs` |
| Nav label | 11 medium (AI label 10 snapped) | `typography.2xs` |
| Body / control | 15 | `typography.base` (controls weight 600) |
| Sheet / empty title | 17 semibold | `typography.lg` (snap) |
| Screen title | 20 semibold | `typography.xl` |
| Auth title | 28 semibold | `typography.3xl` |
| Auth wordmark | 44 bold leading-none | `typography.display` |
| Auth OTP digits | 22 semibold | `typography.2xl` (snap; owner-approved) |
| Auth CTA | 17 semibold | `typography.lg` (snap; owner-approved) |
| Gutter | 16 | `spacing.lg` |
| Field radius | 16 | `radii.lg` |
| Card | 22 | `radii.card` |
| Nav cluster | 24 | `radii.nav` |
| Auth panel | 28 | `radii.authPanel` |
| Sheet top | 30 | `radii.sheet` |
| Button / search / icon | pill | `radii.full` |
| Hit target | 44 / field 48 / auth 54 | `hitTarget.min` / `hitTarget.field` / `hitTarget.auth` |
| List row | min 88 | `hitTarget.row` |
| Pill inset | 2 | `spacing.2xs` |
| Lucide | 18 / 20 | `iconSize.sm` / `iconSize.md` |
| Card shadow | `0 1px 2px rgba(28,28,26,0.05)` | `shadows.sm` (`boxShadow`; New Architecture) |
| Auth panel shadow | `0 14px 40px rgba(28,28,26,0.10)` | `shadows.auth` (`boxShadow`; New Architecture) |
| Nav cluster shadow | `0 8px 24px rgba(28,28,26,0.10)` | `shadows.nav` (`boxShadow`; New Architecture) |
| AI control glow | `0 6px 16px rgba(47,111,237,0.28)` | `shadows.accent` (`boxShadow`; New Architecture) |
| iOS squircle | `CACornerCurve.continuous` | `theme.squircle` (`borderCurve: "continuous"`). Current on RN 0.86 — not deprecated. Android ignores it. Skip on `radii.full` capsules. |

## Shared primitives today

`apps/mobile/src/components/ui/`:

| Primitive | Canvas counterpart | Notes |
| --- | --- | --- |
| `Button` | `Button` | pill; `size: "auth"` is 54 + `typography.lg`; auth disabled uses faint fill, not opacity; `danger` is `destructiveSoft` / `destructive` (pressed inverts to fill); optional `icon` and `fullWidth` |
| `Card` | section / `Card` | 22px, `line` border, `surface` fill |
| `TextField` | `TextField` | 16px radius, canvas fill; optional label / leading / prefix / suffix; `changed` chip uses `StatusPill` `action`; `size: "auth"` is 54 + 16 tabular-nums + focus `ring` |
| `SegmentedTabs` | `AuthModeSwitch` / customers tab strip | `layout="equal"` (default): two-up auth row, track `hitTarget.field`. `layout="scroll"`: compact overflowing CRM strip (canvas `CustomersScreen` tabs — not `BottomNav`). Host is full-bleed; `contentPaddingHorizontal` keeps rest alignment with the padded column and scrolls to the screen edge (no overlay masks, `contentInsetAdjustmentBehavior="never"`, `fadingEdgeLength={0}`). Pills `hitTarget.min` / `typography.sm`. Class B: canvas 40/14 → 44/`typography.sm`. Do not put track chrome on `ScrollView` `contentContainerStyle`. |
| `OtpInput` | `OtpInput` | square cells, gap 8, digits `typography.2xl`; optional inline `error` string |
| `Banner` | inline error | keep; do not invent a second error strip |
| `EmptyState` | `EmptyState` | centered icon badge (48 circle on `muted`), `typography.lg` title, `typography.sm` muted description, optional action slot |
| `StatusPill` | `StatusPill` | soft tone capsule (neutral/action/success/attention/danger); status is never color-only |
| `AppHeader` | `AppHeader` | title/subtitle row with paired back control (`{ onPress, accessibilityLabel }`) and actions slot; screens own the safe-area inset |
| `IconButton` | round icon controls | 44pt circle; `primary` ink fill, `surface` bordered card |
| `SearchField` | list search | raised capsule, leading search icon; not the squircle `TextField` |
| `ChoiceField` | `ChoiceField` | horizontal chip row (44pt chips for list filters) — not the same as SegmentedTabs |
| `Sheet` | confirmation / content sheet | overlay `colors.overlay`, top radius `radii.sheet`, grabber; optional description, `footer` (children become the body), `fullHeight` (92%), close control; host stays mounted and `visible` drives open/close — Modal hides after close timing; sheets not dropdowns |
| `SwitchRow` | `ProductSwitchRow` | label + optional description; 44pt row; success track when on |

**Not shared yet** (add to `ui/` on first screen that needs them): none
listed after SwitchRow landed with the product editor.

Feature examples (never in `ui/`): `OrderRow`, `ProductRow`,
`AssistantSheet`, `BottomNav` (staff shell, not a generic tab primitive).

## Product locks (from the canvas)

- Staff IA: Замовлення, Товари, AI (center), Клієнти, Ще.
- AI is a tab that opens a sheet and **proposes actions for confirmation**.
- Auth: phone and email OTP only in production.
- Sheets, not dropdowns, for pickers on phone.

## Class of change

| Class | Agent action |
| --- | --- |
| **A — craft** | Bind a stray hex/px to the theme; missing 44pt; a11y label |
| **B — scale slip** | Snap 13 vs 12/16 to the table; note in the PR |
| **C — product** | IA, tabs, new screen, copy meaning — canvas first |

If the class is unclear, it is C.
