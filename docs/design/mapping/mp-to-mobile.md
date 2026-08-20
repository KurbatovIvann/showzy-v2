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
   | **Shared primitive** | `apps/mobile/src/components/ui/` | Button, Card, TextField, SegmentedTabs, OtpInput, Banner, later Sheet / StatusPill / EmptyState once they exist |
   | **Feature component** | `apps/mobile/src/components/screens/<feature>/` | OrderRow, ProductImagePicker, AssistantSheet, editor sections |
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
   - Feature → new file under `components/screens/<feature>/`. It may
     compose shared primitives; it must not duplicate their chrome.
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
| Body / control | 15 | `typography.base` (controls weight 600) |
| Sheet / empty title | 17 semibold | `typography.lg` (snap) |
| Screen title | 20 semibold | `typography.xl` |
| Auth title | 28 semibold | `typography.3xl` |
| Gutter | 16 | `spacing.lg` |
| Field radius | 16 | `radii.lg` |
| Card | 22 | `radii.card` |
| Nav cluster | 24 | `radii.nav` |
| Sheet top | 30 | `radii.sheet` |
| Button / search / icon | pill | `radii.full` |
| Hit target | 44 / auth 54 | `hitTarget.min` / `hitTarget.auth` |
| Card shadow | `0 1px 2px rgba(28,28,26,0.05)` | `shadows.sm` |

## Shared primitives today

`apps/mobile/src/components/ui/`:

| Primitive | Canvas counterpart | Notes |
| --- | --- | --- |
| `Button` | `Button` | pill; add `secondary` / `danger` when a screen needs them |
| `Card` | section / `Card` | 22px, `line` border, `surface` fill |
| `TextField` | `TextField` | 16px radius, canvas fill; label/suffix/`changed` when a form needs them |
| `SegmentedTabs` | `AuthModeSwitch` | pill track `muted`, raised `card` |
| `OtpInput` | `OtpInput` | 16px cells; filled digit → ink border |
| `Banner` | inline error | keep; do not invent a second error strip |

**Not shared yet** (add to `ui/` on first screen that needs them): Sheet,
StatusPill, EmptyState, AppHeader, SwitchRow, ChoiceField (chip row — not
the same as SegmentedTabs).

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
