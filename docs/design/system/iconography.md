# Showzy V2 — Iconography and Illustration

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-18 · Stage: SYSTEM  
> Dependency recommendation requires separate approval before implementation

## Direction and licensing

The repository has no package manifest or approved icon dependency.

**Recommendation:** if separately approved during Expo implementation, use only
`@react-native-vector-icons/ionicons`.

Rationale:

- Expo recommends icon-set-specific scoped packages rather than the deprecated
  `@expo/vector-icons` wrapper.
- One family avoids visual mixing and extra fonts.
- Ionicons provides matching outline/filled forms and broad mobile coverage.
- Package and upstream artwork use the MIT license.

Approval must record resolved version, package/artwork licenses, Expo
configuration, and third-party notice. This document does not approve or add a
dependency.

## Core style

- One family, simple metaphors, open shapes, restrained detail.
- Glyph box defaults to 24; sizes: inline 16, compact 20, standard 24,
  prominent 28, sparse empty-state 40.
- Controls remain at least 44×44.
- Use provided stroke geometry; do not simulate custom weight or mix families.
- Optical wrapper correction is at most 1dp and requires a documented fixture.
- Align icon/text visually; wrapped inline status aligns to first text line.
- Use semantic token colors and at least 3:1 meaningful icon contrast.

Outline is default for navigation/actions/objects. Filled is reserved for the
selected equivalent of the same metaphor. Fill/color never acts as the only
selected/status cue.

## Semantic mapping

Conditional Ionicons names; semantic role is normative:

- Global: Discover `search`, Contexts `layers`, Assistant `sparkles`,
  Notifications `notifications`, Account `person-circle`.
- Staff: Home `home`, Orders `receipt`, Assistant `sparkles`, Chat
  `chatbubbles`, More `ellipsis-horizontal-circle`.
- Customer: Company `storefront`; remaining tabs match Staff.
- Company `storefront`; catalog/product `cube` or `bag`; category `grid`;
  cart `cart`; order/invoice `receipt`.
- Document/PDF `document-text` plus visible PDF label when format matters.
- QES `key` or `shield-checkmark` plus explicit signing text.
- Person/customer `person-circle`; staff role `briefcase` plus role text.
- AI `sparkles` plus `AI-помічник`; system `information-circle` plus
  `Системне повідомлення`; human chat uses avatar/name, never sparkles.
- Search/filter/sort `search`/`funnel`/`swap-vertical`.
- Attachment/upload/download `attach`/`cloud-upload`/`cloud-download`.
- Offline/sync/pending `cloud-offline`/`sync`/`time` plus text.
- Success/warning/failure `checkmark-circle`/`warning`/`close-circle` plus text.

AI/human/system/domain authorship remains textual/structural. AI never uses
shield/signature/check to imply authority or completion before evidence.

## Actions, status, and badges

- Trash means deletion only; Close dismisses UI and never means domain cancel.
- Warning indicates risk, not ordinary information.
- Consequential actions combine exact visible verb, confirmation, text, and
  risk structure.
- Avoid sparkle/lightning “magic” treatment for risky actions.
- Numeric badges visually show 1–99/99+, while accessible label states full
  count. An unread dot requires equivalent text/state.
- Progress uses a progress component, not endlessly rotating status icon.
- Reduced Motion removes non-essential spin/pulse.

## RTL, accessibility, and fallback

- Mirror Back/Forward, Reply, Undo/Redo, Send, and directional movement.
- Do not mirror brands, checkmarks, clocks, media, documents, keys, status, or
  intrinsically oriented product media.
- Use logical start/end, not hard-coded left/right.
- Icon-only controls expose localized name, role, state, and consequence hint.
- Decorative/repeated icons are hidden; one control is one accessible element.
- Unfamiliar icons receive visible text/tooltip.
- Missing approved glyph falls back to text action first.
- Critical custom SVG needs owner approval, source/license, optimized bounds,
  theme/contrast, RTL, and accessibility review.
- Never substitute emoji, Unicode, remote icons, question marks, or another
  family.
- Failed icon load leaves visible label and activation usable.

## Illustration policy

Illustration is optional and limited to onboarding or rare first-use/empty
states where it clarifies the next action. Errors, offline, permission, risk,
documents, and QES do not use playful scenes. Product/company media is domain
content, not system illustration.

Production art records author/source URL, license, download date, modification
rights, asset hash, and attribution. Unknown-license community assets are
prohibited. Generated artwork requires explicit owner approval, model/terms/
provenance, human review, and a demonstrated communication purpose.

## Token reconciliation and acceptance

Use `dimensions.icon.*`, `colors.semantic.text|action|status|risk|context.*`,
focus, motion, badge, spacing, and 44×44 tokens from `tokens.md`. Components
select semantic role/size, never arbitrary glyph color/size.

Acceptance:

- One approved family covers all three five-tab shells.
- Dependency/version/license approval precedes installation.
- Selection, status, risk, QES, completion, and authorship work without icon or
  color alone.
- RTL, icon failure, 200%/expanded text, grayscale, screen-reader names/counts,
  44×44, contrast, and Reduced Motion pass.
- Custom assets have complete provenance.
- Findings remain `internal evaluation only`.

## Sources

Accessed 2026-08-17:

- [Expo icon guide](https://docs.expo.dev/guides/icons/)
- [Expo scoped-icons migration](https://expo.dev/blog/moving-away-from-expo-vector-icons)
- [Scoped Ionicons package](https://www.npmjs.com/package/@react-native-vector-icons/ionicons)
- [Ionicons MIT license](https://github.com/ionic-team/ionicons/blob/main/LICENSE)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
