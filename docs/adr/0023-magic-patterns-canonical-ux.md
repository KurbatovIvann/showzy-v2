# ADR-0023: Magic Patterns canvas is the canonical V2 UX

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: Human owner
- **Supersedes**: ADR-0019
- **Amended**: 2026-08-20 — Magic Patterns has no required design-system
  preset. The Unistyles theme in `apps/mobile` is the design system.

## Context

ADR-0019 made the V1 mobile app the visual and behavioral baseline for V2
so the rewrite would not invent a second product. That reduced risk while
the action architecture was still being built.

The owner has since decided to design V2 as a new mobile experience. The
working prototype lives in one Magic Patterns canvas:

- `https://www.magicpatterns.com/c/g4fsekajwwkeex3v612gvp`

Magic Patterns emits React + Tailwind, not React Native. `apps/mobile` is
Expo + Unistyles. Copying prototype JSX into the app would create a second
styling stack (and would require an unapproved NativeWind dependency).

An existing Magic Patterns canvas cannot be rebound to a custom design
system after the fact. A parallel DS inside Magic Patterns is not useful:
tokens and primitives belong in Expo, where the product runs.

V1 remains a useful record of domain edge cases. It is no longer the look
the owner wants to ship.

## Decision

The Magic Patterns canvas is the canonical visual language, information
architecture, and interaction model for V2 mobile. V1 mobile stays
read-only reference for domain behavior, copy keys, and edge cases — not
for layout, color, navigation, or motion.

Magic Patterns output is a **design spec**, not production code. Screens
are re-implemented in `apps/mobile` with Unistyles, expo-router, and
Reanimated. Do not paste Tailwind, `div`/`button`/`input`,
`react-router-dom`, `framer-motion`, or `sonner` into the app.

The **design system lives in Expo**: `apps/mobile/src/theme/` plus shared
primitives in `apps/mobile/src/components/ui/`. Canvas hex/px/radius
values are mapped there
([`docs/design/mapping/mp-to-mobile.md`](../design/mapping/mp-to-mobile.md)).
There is no Magic Patterns design-system requirement.

When implementing a canvas screen, the agent inventories the visual
pieces, classifies each as **shared** (Button, Card, tabs, input, …) or
**feature-specific**, reuses or extends `components/ui` for shared ones,
and only then writes screen code.

Figma is still not a source of tokens or components.

Owner-accepted product changes relative to ADR-0019, as currently drawn:

- staff tabs are Orders, Products, Customers, More, with **AI as the center
  tab** that opens a confirmation sheet (not a fifth overlay-only secret);
- primary chrome is warm canvas, ink fills, pill controls, and blue `action`
  for AI / focus — not the V1 glass tab bar;
- light mode from the canvas is canonical first; dark is a later
  role-by-role mapping of the same tokens, not a per-screen invention.

Architecture ADRs still win over the prototype when they conflict:

- ADR-0006 — shipped auth is phone/email OTP only. Google and guest
  controls on the canvas are prototype scaffolding and must not ship.
- ADR-0010 — Expo remains the launch client; web is post-launch.
- ADR-0011 / contract — chat stores IDs; orders own state; clients never
  touch the database.

Surfaces that are not yet on the canvas (customer cabinet, consumer
discovery, chat/messages as a tab, documents, settings) stay blocked until
they are designed there. Do not invent those screens in Expo.

## Alternatives considered

- **Keep ADR-0019 and treat Magic Patterns as exploration** — rejected:
  the owner wants the new design to ship.
- **Compile Magic Patterns React into the Expo app (NativeWind / WebView)** —
  rejected: NativeWind is a new dependency; WebView would fork the action
  client; Unistyles is already the SYSTEM.
- **Maintain a custom design system inside Magic Patterns** — rejected:
  the live canvas cannot switch its active preset, and the running app
  would still need a Unistyles map. One system in Expo is enough.
- **Preserve V1 navigation and restyle only** — rejected: the canvas
  changes tabs, AI placement, and control chrome on purpose.

## Consequences

- ADR-0019 is superseded. V1 inventories and the old port recipe remain
  historical reference (`docs/design/inventory/`,
  `docs/design/mapping/v1-mobile-port-recipe.md`) and must not be used as
  visual acceptance.
- Experience Foundation SYSTEM is the Unistyles theme and
  `components/ui` primitives. The Magic Patterns canvas is the prototype
  to read, not a second component library.
- The UX gate still blocks product screens. It checks canvas coverage and
  Unistyles fidelity, not V1 pixel parity. Auth/shell/deep-link
  infrastructure remains ungated as foundation work, but new auth visuals
  follow the canvas.
- `vm-T29` (AI overlay) is re-scoped: the canvas already places AI in the
  tab bar. Classic UI and AI still call the same actions.
- A later color tweak still requires a role-by-role map; do not restyle
  one screen in isolation.
