# Showzy V2 — Mobile Layout System

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-18 · Stage: SYSTEM  
> Boundary: phone-first Expo launch; full web UI is post-launch

## Principles and shells

- Use current window dimensions, not device name/orientation.
- Company-scoped screens show role/company near the start.
- Layout never implies authorization.
- Text/control containers reflow; fixed text heights are prohibited.
- Classic and AI share cards/states/routes; dense/high-risk/QES uses classic.

One binary provides three approved five-tab shells:

- Global: Discover, Contexts, Assistant, Notifications, Account.
- Staff: Home, Orders, Assistant, Chat, More.
- Customer: Company, Orders, Assistant, Chat, More.

Assistant stays centered. Context switching rebuilds the shell, closes overlays,
invalidates unconfirmed work, and never moves a cart/target/proposal to another
company unless a draft is explicitly keyed there. Full-screen tasks may hide
tabs but retain role/company, title, and safe exit.

## Adaptive grid

From `tokens.md`:

- Compact `<600`: 4 columns, 16 gutter, 12 gap.
- Medium `600–839`: 8 columns, 24 gutter, 16 gap.
- Expanded `≥840`: 12 columns, 32 gutter, 24 gap.

Form/read/single-pane/shell max widths are 600/680/720/1200. Compact defaults
to one pane. Medium/expanded may use list-detail only when both panes remain
usable at current font scale. At 200% or constrained height, collapse before
truncating or hiding actions.

A fold hinge is an occlusion. Resize, rotation, split screen, and posture
preserve safe route, focus, draft, position, and object.

## Safe area, header, and tabs

- Background may extend edge-to-edge; text/actions respect cutout, gesture,
  system-bar, hinge, and keyboard insets exactly once.
- Header order: Back/Close, title, Global/Staff/Customer-company context,
  context switcher, then cart/notification/overflow/recovery.
- Header grows vertically and has no fixed text height.
- Context switcher is labeled, role-grouped, and warns on unsaved work.
- Tabs preserve five items/order; bar height grows for inset and text.
- Each tab is 44×44 minimum with role, selected state, position, icon, and short
  label. Labels do not ellipsize.
- Smallest-width 200% prototype must approve shorter labels or an accessible
  selected-label treatment; never cap font scale.
- No navigation rail without IA review.

Portrait/landscape provide the same journeys. Tablets may add a supporting
pane. No hover-only, pointer-required, desktop-menu, or browser-continuation
launch behavior.

## Keyboard, focus, and actions

- Forms/chat use keyboard-aware scroll; field, label, error, and next action
  remain visible.
- Keyboard never submits, discards, switches context, closes a sheet, or hides
  the only recovery.
- Focus order: title, context, primary content, local actions, persistent nav.
- Temporary UI focuses title/summary and restores invoker.
- Prefer inline primary action. At most one floating action is allowed for a
  frequent low-risk create task with an equivalent labeled route.
- Financial, destructive, cross-company, legal, document, and QES actions are
  never floating shortcuts.
- Sticky bars reserve space, include inset, wrap/stack, and move into flow when
  height is constrained.

## Surface patterns

### Forms, lists, and cards

- Compact forms are one column with persistent labels/help.
- Two fields share a row only if both work at 200%; dense address/delivery/
  variant/document/confirmation uses full screen.
- Errors appear beside fields and in ordered summary; values/focus survive
  recoverable failure.
- Queues show title, reason, count, filters, and one dominant next action.
- Rows/cards lead with identity, then status/time, summary, actions.
- Realtime/filter/pagination preserves position/focus.
- Browse grids may expand; operational queues remain scan-friendly lists.
- Cards have no fixed text height; child actions remain separately focusable.

### Business and AI chat

- History fills between contextual header and composer.
- Unread boundary/New messages prevents forced jump-to-latest.
- Composer grows then offers expanded editor; attachment/send remain reachable
  with keyboard, inset, and 200% text.
- Order/document cards open canonical current state and store no copied status.
- AI scope stays visible; streaming preserves focus/reading position.
- Pause, Resume, Stop remain persistent and accessible.
- AI cards share classic width/names/states/actions and always expose a labeled
  classic route; unsupported rendering falls back to text plus that route.

### Temporary UI, documents, and feedback

- Sheets are short choices/support. Long forms, recovery, documents, and
  consequential confirmation use full screen.
- Medium/expanded modal max is 560 unless showing a document.
- Temporary UI has title, Close/Back, focus containment/restoration,
  background hiding, keyboard/safe-area support, and swipe alternative.
- Avoid nested sheets and multiple modal layers.
- Structured document content is the primary accessible view; PDF is explicit
  preview. Medium/expanded may show both.
- QES has a dedicated classic flow with parties, signer, exact version, effect,
  consequence, and refreshed return state; focus starts on summary.
- Offline banner below header shows connection, last sync, pending count, and
  disabled actions without stealing focus.
- Toast is grouped/single-announcement and never the only durable result/error.

## Accessibility and motion

- Every action is at least 44×44 with non-overlapping hit area.
- Default, 200%, maximum, bold, and 30% expanded text wrap without overlap,
  hidden action, or ordinary horizontal scroll.
- Screen-reader, keyboard, and switch order matches visible logic.
- Sticky UI never obscures focus.
- Reduced Motion removes parallax, loops, flashing skeletons, reorder, and
  non-essential displacement.
- Drag/swipe/long-press/precision gestures have labeled single-pointer
  alternatives.

## Token/dependency boundary

Consume `breakpoints`, `grid`, `containers`, `space`, `dimensions`, `safeArea`,
typography, focus, radii, elevation, layers, and motion from `tokens.md`;
screen-local duplicates are prohibited.

No package is approved here. Future implementation must review manifests and
request explicit approval before safe-area or keyboard-controller dependencies.

## Acceptance

- Three shells exactly match IA and always expose context.
- Fixtures pass at 320, 599, 600, 839, 840, max container, both orientations,
  split screen/tablet, and practical fold posture.
- Text scaling/expansion, keyboard, safe areas, 44×44, focus, Reduced Motion,
  offline, and all operational states pass.
- Incoming chat/AI preserves reading position.
- PDF has structured equivalent; risky actions are never floating.
- No fixed text height, hover, precision gesture, or post-launch web IA.
- Real-device iOS/VoiceOver and Android/TalkBack findings are
  `internal evaluation only`.

## Sources

Accessed 2026-08-17:

- [Material breakpoints](https://m3.material.io/foundations/layout/breakpoints/overview)
- [React Native window dimensions](https://reactnative.dev/docs/usewindowdimensions)
- [Expo safe-area context](https://docs.expo.dev/versions/latest/sdk/safe-area-context)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
