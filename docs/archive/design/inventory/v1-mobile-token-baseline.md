# V1 mobile token baseline

> **Archived 2026-08-21.** ADR-0019 token dump. **Not visual acceptance.**
> The running theme is `apps/mobile/src/theme/`, mapped from the Magic
> Patterns canvas (`docs/design/mapping/mp-to-mobile.md`, ADR-0024).

> Status: Archived inventory from the ADR-0019 rebaseline.
> Source: `E:\showzy\apps\mobile\src\theme`.

These were the V1 tokens at the 2026-08-17 audit. They are not the V2
theme to ship.

## Color roles

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#F0EDE7` | `#161410` |
| Foreground | `#1A1814` | `#E6E3DD` |
| Card/popover | `#FDFCFA` | `#211F1A` |
| Primary | `#1C1A15` | `#E6E3DD` |
| Secondary | `#E8E5DF` | `#2A2722` |
| Muted foreground | `#7A7570` | `#908B84` |
| Accent/ring | `#2684CC` | `#5CB0E0` |
| Border/input | `#D8D4CC` | `#322F2A` |
| Destructive | `#EF4343` | `#D15147` |
| Success | `#21C45D` | `#4CA957` |
| Warning | `#F59F0A` | `#CD922D` |

Order and document statuses retain semantic role tokens with paired foreground
colors. Status must never be communicated by color alone.

## Geometry

- Spacing scale: `4, 8, 12, 16, 20, 24, 32`.
- Radius scale: `8, 12, 16, 20, 25`, plus full/pill.
- Avatar sizes: `32, 42, 80, 96`.
- Company avatar sizes: `32, 36, 44, 64, 120`, with proportional radii.
- Shadows: four elevation levels with warm `#2A2518` shadow color.

## Typography

The system font uses these size/line-height pairs:

| Token | Size / line height |
| --- | --- |
| `xs` | `13 / 18` |
| `sm` | `14 / 20` |
| `base` | `15 / 22` |
| `md` | `16 / 22` |
| `lg` | `18 / 24` |
| `xl` | `20 / 26` |
| `2xl` | `24 / 30` |
| `3xl` | `28 / 34` |
| `4xl` | `32 / 38` |

Weights remain component-level until the component contract inventory
normalizes them. Dynamic type must be validated before the UX gate opens.

## Glass and surfaces

- Standard fallback: `rgba(253, 252, 250, 0.85)`.
- Dense fallback: `rgba(253, 252, 250, 0.92)`.
- Glass tab bars remain absolute-positioned with safe-area compensation.
- Native glass/blur must have an equivalent contrast-safe fallback.

## Theme contract

- Modes: light, dark, system.
- User preference persists locally; system mode follows platform changes.
- Components consume semantic roles, never raw palette values, except audited
  artwork/brand assets.
- New AI overlay, account deletion, and compliance UI use this same token set.
- A later palette proposal must provide role-by-role mapping and contrast
  evidence; it cannot be applied per screen.

## Motion baseline

- Default stack: right-slide with full-screen back gesture.
- Image viewer: 200 ms fade.
- Product carousel: bottom page sheet.
- Browser/signing: native form sheet with grabber and rounded corners.
- Preserve product shared-element motion, list/sheet transitions, chat typing,
  voice/reaction feedback, haptics, and keyboard choreography.
- Reduced-motion mode replaces nonessential shared-element and decorative
  motion without changing task flow.
