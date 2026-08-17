# Showzy V2 — Design Tokens

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-15 · Stage: SYSTEM  
> Target: 1:1 future React Native Unistyles theme mapping  
> Evidence: approved DEFINE constraints and internal standards review only

## Purpose and capability boundary

This token-only foundation serves the Expo mobile app across Classic, AI,
business chat, Global, Staff, and Customer contexts. It contains no component
implementation.

Expo/Unistyles are approved directions, but the repository has no package
manifest or lockfile. Therefore this artifact uses system fonts, assumes no
installed styling/font package, and adds no dependency.

## Theme shape and naming

The registry namespace is `themes`; launch object is `themes.light`. Every
future theme must expose identical paths and value types.

```text
themes.light
├── colors
│   ├── primitive
│   └── semantic
├── typography
│   ├── family / size / lineHeight / weight / letterSpacing / role
├── space / dimensions / radii / borders
├── elevation / opacity / layers
├── breakpoints / grid / containers / safeArea
├── motion / statusCues / chart
```

Rules:

- Lower camel-case ASCII names; primitives use `n50`…`n950`.
- Product artifacts use semantic paths, never raw primitives/literals.
- Name purpose, not color: `text.danger`, never `text.red`.
- Do not encode role, tenant authority, or domain truth through color.
- Runtime insets, font scale, appearance, and Reduced Motion stay runtime data.
- A new theme missing any semantic path is invalid.

## Primitive palette

Neutral:

- `neutral.n0 #FFFFFF`, `n50 #F8FAFC`, `n100 #F1F5F9`,
  `n200 #E2E8F0`, `n300 #CBD5E1`, `n400 #94A3B8`.
- `neutral.n500 #64748B`, `n600 #475569`, `n700 #334155`,
  `n800 #1E293B`, `n900 #0F172A`, `n950 #020617`.

Brand indigo:

- `indigo.n50 #EEF2FF`, `n100 #E0E7FF`, `n200 #C7D2FE`,
  `n300 #A5B4FC`, `n400 #818CF8`, `n500 #6366F1`.
- `indigo.n600 #4F46E5`, `n700 #4338CA`, `n800 #3730A3`,
  `n900 #312E81`.

Functional `n50 / n700 / n800 / n900`:

- Green `#F0FDF4 / #15803D / #166534 / #14532D`.
- Amber `#FFFBEB / #B45309 / #92400E / #78350F`.
- Red `#FEF2F2 / #B91C1C / #991B1B / #7F1D1D`.
- Blue `#EFF6FF / #1D4ED8 / #1E40AF / #1E3A8A`.
- Teal `#F0FDFA / #0F766E / #115E59 / #134E4A`.
- Violet `#F5F3FF / #6D28D9 / #5B21B6 / #4C1D95`.

## Light semantic colors

Background/surface:

- `background.canvas #F8FAFC`, `background.app #FFFFFF`.
- `surface.default|raised #FFFFFF`, `surface.sunken #F1F5F9`,
  `surface.selected #EEF2FF`.

Text:

- `text.primary #0F172A`, `secondary #334155`, `muted #475569`,
  `subtle #64748B`, `inverse|onBrand|onCritical #FFFFFF`,
  `link #3730A3`, `disabled #475569`.
- `text.subtle` is the lightest permitted normal text on white.

Border/focus:

- `border.subtle #CBD5E1`, `default #64748B`, `strong #475569`,
  `selected #4F46E5`, `disabled #CBD5E1`.
- `focus.ring #4F46E5`, `focus.offset #FFFFFF`.
- Subtle border is decorative only; actionable boundaries use default/strong.

Actions:

- `action.primary`: background `#4338CA`, foreground `#FFFFFF`, pressed
  `#3730A3`.
- `action.secondary`: background `#FFFFFF`, foreground `#334155`, pressed
  `#F1F5F9`.
- `action.destructive`: background `#991B1B`, foreground `#FFFFFF`, pressed
  `#7F1D1D`.
- `action.disabled`: background `#F1F5F9`, foreground `#475569`.

Status paths are `status.<neutral|information|success|warning|danger>.*`:

- Neutral: surface `#F1F5F9`, text/icon `#334155`, border `#64748B`.
- Information: `#EFF6FF`, `#1E40AF`, `#1D4ED8`.
- Success: `#F0FDF4`, `#166534`, `#15803D`.
- Warning: `#FFFBEB`, `#92400E`, `#B45309`.
- Danger: `#FEF2F2`, `#991B1B`, `#B91C1C`.

Risk paths are `risk.<low|medium|high|critical>.*`:

- Low: surface `#F0FDFA`, foreground `#115E59`, border `#0F766E`.
- Medium: `#FFFBEB`, `#92400E`, `#B45309`.
- High: `#FEF2F2`, `#991B1B`, `#B91C1C`.
- Critical: `#991B1B`, `#FFFFFF`, `#7F1D1D`.

Context paths are `context.<global|staff|customer|assistant>.*`:

- Global: surface `#EFF6FF`, text `#1E40AF`, border `#1D4ED8`.
- Staff: `#EEF2FF`, `#312E81`, `#4F46E5`.
- Customer: `#F0FDFA`, `#115E59`, `#0F766E`.
- Assistant: `#F5F3FF`, `#4C1D95`, `#6D28D9`.

Context/status/risk color always accompanies localized text, accessible state,
and icon/structure. It never grants authority or replaces company/role.

Other:

- `overlay.scrim rgba(15,23,42,0.56)`, `scrimStrong ...0.72`.
- `skeleton.base #E2E8F0`, `highlight #F8FAFC`.
- `selection.background #E0E7FF`, `foreground #312E81`.

## Checked contrast pairs

WCAG sRGB ratios, rounded:

- Primary/white `#0F172A` 17.85:1; secondary 10.35:1; muted 7.58:1;
  subtle 4.76:1.
- White/primary action `#4338CA` 7.90:1; link/white 9.93:1.
- Focus `#4F46E5` on white 6.29:1; on canvas 6.01:1.
- Success text/surface 6.81:1; border/surface 4.79:1.
- Warning 6.84:1 / 4.84:1; danger 7.60:1 / 5.91:1;
  information 8.01:1 / 6.16:1.
- White/critical `#991B1B` 8.31:1; disabled label/background 6.92:1.

Unlisted combinations are not approved. Device tests still verify transparent,
image, gradient, and platform-rendered combinations.

## Typography

Families:

- `family.sans`: SF Pro Text/system sans on iOS; Roboto/system sans Android.
- `family.display`: SF Pro Display/Text/system; Roboto/system Android.
- `family.mono`: SF Mono/system monospace; system monospace Android.

No custom font is required; Ukrainian/mixed Cyrillic/Latin content is tested.
Sizes are unscaled pt/dp and system scaling must remain enabled:

- `xs 12/16`, `sm 14/20`, `md 16/24`, `lg 18/28`.
- `xl 20/28`, `xxl 24/32`, `xxxl 30/38`, `display 36/44`.

Weights: regular 400, medium 500, semibold 600, bold 700. Letter spacing:
tight -0.3, slightTight -0.1, normal 0, wide 0.2.

Roles:

- `display 36/44 bold`, `titleLarge 30/38 bold`,
  `titleMedium 24/32 bold`, `titleSmall 20/28 semibold`.
- `bodyLarge 18/28`, `body 16/24`, `bodySmall 14/20`.
- `label 14/20 semibold`, `labelSmall 12/16 semibold`,
  `caption 12/16`, `code 14/20 mono`.

At 200%, containers grow/wrap; essential state, totals, confirmation, and
actions never truncate. Allow at least 30% localization expansion.

## Spacing, dimensions, radii, borders

Spacing: `none 0`, `xxs 2`, `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`,
`xxl 24`, `xxxl 32`, `section 40`, `sectionLarge 48`, `page 64`.

Dimensions:

- `touch.minimum 44`; controls small/medium/large `44/48/56`.
- Icons inline/compact/standard/prominent/empty `16/20/24/28/40`.
- Focus width/offset `3/2`.

Radii: `none 0`, `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `pill 999`.
Border widths: none/default/strong/focus `0/1/2/3`.

## Elevation, opacity, and layers

Elevation `level0…4`:

- iOS Y/radius/opacity: `0/0/0`, `1/3/.08`, `3/8/.10`, `6/16/.14`,
  `10/24/.18`, with X 0 and shadow `#0F172A`.
- Android elevation: `0, 2, 4, 8, 12`.

Elevation indicates containment only, never focus/status/authorization.

Opacity: opaque 1, subdued .72, disabledDecoration .48, pressedOverlay .12,
dragged .92, hidden 0. Essential text/state never uses reduced opacity.

Layers: content 0, sticky 10, navigation 20, sheet 30, modal 40, toast 50,
critical 60. Accessibility traversal is independent of visual layer.

## Breakpoints, grid, containers, and safe areas

Breakpoints from current window width: compact 0, medium 600, expanded 840,
wide 1200.

- Compact grid: 4 columns, gutter 16, gap 12.
- Medium: 8 columns, gutter 24, gap 16.
- Expanded: 12 columns, gutter 32, gap 24.

Container max: form 600, reading 680, singlePane 720, content 840, shell 1200.
At 200%, reflow/collapse precedes truncation or extra columns.

Safe-area minimums: horizontal 16, top/bottom 0, floating bottom gap 16,
keyboard gap 12. Effective padding is max(runtime inset, minimum token).

## Motion

Durations: instant 0, fast 120, standard 200, slow 320, deliberate 480 ms.

Easing cubic Bézier: linear `0,0,1,1`; standard/emphasized `0.2,0,0,1`;
enter `0,0,0,1`; exit `0.4,0,1,1`.

Reduced Motion: duration/displacement/repeat `0`; feedback fade max 100 ms.
Remove parallax, animated reorder, loops, flashing skeleton, and non-essential
movement. Audio/haptics never replace state.

## Status cues and charts

Neutral/information/success/warning/danger use neutral/info/check/alert/error
icon or structure plus localized state text. Risk additionally names effect,
consequence, reversibility, and confirmation. Icon names are placeholders for
SHO-18; color/icon/animation/emoji are never sole cues.

Simple analytics series:

- `series1 #4338CA` solid/circle; `series2 #0F766E` dashed/square.
- `series3 #B45309` dotted/triangle; `series4 #BE123C` dash-dot/diamond.
- `series5 #0369A1` long-dash/cross; `series6 #6D28D9` double-dot/star.
- Axis `#64748B`, grid `#CBD5E1`, label `#334155`, surface `#FFFFFF`,
  selection `#0F172A`.

Every chart has title, summary, exact-value list/table, structural series cues,
logical focus, and reduced motion.

## Product mapping

- IA context colors reinforce visible Global / Staff · company /
  Customer · company / AI labels.
- Classic forms/lists/cards/sheets use semantic surfaces, text, boundaries,
  spacing, typography, 44×44, and state roles.
- AI proposals, running, result, partial, and failure remain distinct and
  always provide a classic route.
- Business chat uses textual human/AI/system authorship and explicit
  send/read/sync states.
- Orders show success only after authoritative evidence; chat cards fetch
  current state.
- Documents keep generation/artifact/signature/verification separate; QES
  confirmation uses high/critical presentation only when consequential.

## Dark-mode recommendation

**Decision: dark mode is deferred from V2 launch by owner approval on
2026-08-17.**

No approved/evaluated dark palette exists, and every shipped theme would
multiply contrast/device checks across Classic, AI, overlays, charts, PDF,
documents, and QES. Launch already requires evaluation of a new mobile
dual-flow system.

Architecture remains compatible: `themes.dark` must mirror every light path;
artifacts use semantic tokens; a later dark theme requires a complete palette,
contrast matrix, image/PDF strategy, and real-device evaluation.

Dark mode is post-launch work and requires a separately reviewed complete
theme before implementation.

## Acceptance

- Every category maps 1:1 into one future Unistyles object.
- Semantic tokens replace raw product literals.
- Contrast, grayscale, 200%/maximum text, 30% expansion, 44×44, safe areas,
  keyboard, both orientations, breakpoints, and Reduced Motion pass.
- Classic/AI use the same semantic state categories.
- Authorship, context, risk, order completion, documents, and QES remain clear
  without color.
- Charts have structural/text equivalents.
- No font/styling dependency is assumed or added.
- Findings remain `internal evaluation only`; this is not WCAG certification
  or external validation.
