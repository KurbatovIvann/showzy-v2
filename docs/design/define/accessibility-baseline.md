# Showzy V2 — Accessibility Baseline

> Status: Approval #2 granted by the owner on 2026-08-17  
> Linear: SHO-13 · Stage: DEFINE  
> Target: WCAG 2.1 AA-oriented native mobile baseline  
> Evidence: standards and internal constraints, not preference research or a
> conformance certification

## Purpose and use

This baseline applies to every theme, locale, context, entry path, and state in
the Expo app, including classic UI, AI, realtime, documents, QES, and links.

**MUST** is release-required. **SHOULD** needs a documented reason to differ.
An exception records the unmet rule, reason, accessible alternative, evidence,
owner approval, and follow-up. Convenience is not a valid reason.

WCAG maps imperfectly to native apps; requirements use the closest iOS/Android
semantics and add mobile safeguards. The Showzy 44×44 target is stricter than
WCAG 2.1 AA.

## Perceivable content

### Contrast and non-color state

- **AX-C01:** Normal text is at least `4.5:1`; large text at least `3:1`.
- **AX-C02:** Meaningful icons, controls, focus indicators, selection, and
  boundaries are at least `3:1` against adjacent colors.
- **AX-C03:** Ratios hold over every image/gradient/skeleton and in every
  shipped theme/system appearance.
- **AX-C04:** Placeholder never replaces a visible label and meets contrast if
  it conveys required information.
- **AX-C05:** Status, selection, validation, sync, risk, and completion use
  visible text plus icon/structure; color alone is prohibited.
- **AX-C06:** Order, payment, delivery, document, QES, message, AI, read/unread,
  online/offline, and sync states expose text and accessible semantics.
- **AX-C07:** Grayscale leaves every state/action understandable.

### Text and media

- **AX-T01:** System font scaling remains enabled; global
  `allowFontScaling={false}` is prohibited.
- **AX-T02:** Screens remain operable at 200% text and are tested at the
  largest supported accessibility size.
- **AX-T03:** Text wraps without clipping/overlap/hidden actions. Fixed-height
  text containers and essential truncation are prohibited.
- **AX-T04:** Ordinary text requires no horizontal scroll. Tables/PDF/charts
  may scroll only with an accessible linear equivalent.
- **AX-T05:** Layout tolerates bold text and 30% localization expansion.
- **AX-M01:** Informative images have localized purpose-specific alternatives;
  decorative/repeated images are hidden.
- **AX-M02:** Product identity, variant, price, and availability never depend
  on an image alone.
- **AX-M03:** Information-bearing prerecorded media has captions/transcript.

## Operable interaction

### Touch, gesture, and motion

- **AX-O01:** Every action has at least a `44×44` pt/dp activation area.
- **AX-O02:** `hitSlop` cannot overlap another target. Smaller essential
  targets require a measured exception and equivalent 44×44 action.
- **AX-O03:** Adjacent destructive/context-switch actions have enough spacing
  to prevent accidental activation.
- **AX-O04:** Drag, swipe, long press, multi-touch, path, or device-motion
  gestures have a single-pointer labeled alternative.
- **AX-O05:** Respect system Reduced Motion; remove parallax, loops, flashing
  skeletons, and animated reordering.
- **AX-O06:** Nothing flashes more than three times per second.
- **AX-O07:** Haptics/audio reinforce but never replace visible/accessibility
  state; muted/disabled feedback does not block a task.

### Focus and structure

- **AX-F01:** Focus follows title, active context, primary content, then actions.
- **AX-F02:** Navigation, validation, list/realtime updates, and conditional
  content never move focus unexpectedly.
- **AX-F03:** New content does not take focus unless immediate interaction is
  required.
- **AX-F04:** Closing a modal/sheet/menu returns focus to its invoker or nearest
  replacement; removing a focused item chooses a predictable neighbor.
- **AX-F05:** Hidden, off-screen, obscured, and modal-background controls leave
  the accessibility tree.
- **AX-F06:** Virtualized lists preserve stable focus through insertion,
  filtering, and pagination.
- **AX-S01:** Every screen has one visible title exposed as a header.
- **AX-S02:** Major sections/card groups use headers; lists expose a useful
  name, grouping/count, and item boundaries.
- **AX-S03:** Tabs/toolbars expose navigation purpose, selected state, and
  position.
- **AX-S04:** Global/Staff/Customer plus company context appears near the start,
  not only through color/avatar.

### Screen reader, keyboard, and switch

- **AX-R01:** Every control exposes a concise localized name, native role,
  state, value, and supported action.
- **AX-R02:** Hints describe unfamiliar consequence without duplicating name.
- **AX-R03:** Custom controls match native semantics; cards with child actions
  keep those actions separately focusable.
- **AX-R04:** Context is included in labels when omission risks cross-company
  action.
- **AX-R05:** Busy/progress state is exposed without repeated unchanged
  announcements.
- **AX-K01:** Every action works with hardware keyboard and switch scanning in
  the same logical order.
- **AX-K02:** Focus is visually apparent at `3:1` and not hidden by sticky UI or
  keyboard.
- **AX-K03:** Enter/Space activates by platform convention; Escape/Back closes
  temporary UI when safe.
- **AX-K04:** No journey requires touch coordinates, precision dragging,
  device motion, or simultaneous input.

### Layout and keyboard

- **AX-L01:** Content remains inside safe areas and system navigation/cutouts.
- **AX-L02:** Focused fields/errors scroll above the software keyboard; every
  field/action remains reachable while it is open.
- **AX-L03:** Keyboard dismissal never submits, discards input, or changes
  context.
- **AX-L04:** Sticky composers/action bars handle safe area, multiline text,
  dynamic type, and keyboard.
- **AX-L05:** Portrait and landscape are supported unless an essential,
  documented exception applies.
- **AX-L06:** Smallest supported width at 200% text reflows without loss.

## Forms and confirmation

- **AX-FORM01:** Every field has a persistent visible label and matching
  accessible name.
- **AX-FORM02:** Required/optional, format, unit, and constraints are available
  before input and not conveyed by asterisk/color alone.
- **AX-FORM03:** Use suitable keyboard/autofill while allowing paste and
  assistive input; OTP supports paste/autofill as one logical value.
- **AX-FORM04:** Errors identify field and correction, are associated/announced
  once, persist until fixed, and preserve valid values.
- **AX-FORM05:** Failed submit focuses an error summary or first invalid field.
- **AX-FORM06:** Destructive, irreversible, financial, cross-company,
  document-generation, and QES actions show a plain-language summary.
- **AX-FORM07:** Summary identifies actor/company, target, amount/effect,
  destination/counterparty, reversibility, and consequence where applicable.
- **AX-FORM08:** Confirmation focus starts on summary, never the destructive
  button; Confirm/Cancel use explicit verbs.

## Temporary UI, lists, and states

- **AX-U01:** Modal/sheet announces title, traps focus, hides background,
  provides labeled close/back, works at 200% with keyboard, and restores focus.
- **AX-U02:** Swipe dismissal has a button/keyboard equivalent.
- **AX-U03:** Toast announces once with suitable urgency and is never the only
  record of an error, identifier, completion, or required action.
- **AX-U04:** Realtime toasts/announcements group bursts.
- **AX-LIST01:** Rows/cards name object type/identity before status and expose
  independent child actions separately.
- **AX-LIST02:** Status queues expose heading/count; cards expose status, time,
  next action, and recovery.
- **AX-LIST03:** Reordering/filtering/insertion preserves position/focus;
  infinite loading has explicit progress and Retry/Load more.
- **AX-ST01:** Every data surface defines loading, loaded, empty, partial,
  error, offline, retry, and disabled states where applicable.
- **AX-ST02:** Skeletons are hidden; containing region announces loading once.
- **AX-ST03:** Determinate progress exposes label/value; indeterminate exposes
  a concise busy state.
- **AX-ST04:** Empty/error names what is empty/failed, preserved progress, and
  one valid next action.
- **AX-ST05:** Offline exposes last sync, pending count, and disabled actions.
- **AX-ST06:** Retry names the operation, preserves input, and cannot duplicate
  orders, documents, messages, signatures, or AI actions.
- **AX-ST07:** Partial/reversal state says what completed, failed, and happens
  next.

## Push and deep links

- **AX-DL01:** Push, invite, direct, QR, order/chat, and QES callback preserve
  intent through install/sign-in.
- **AX-DL02:** Destination refetches current authorized state; payload IDs
  never grant access.
- **AX-DL03:** Focus lands on destination title or error heading.
- **AX-DL04:** Expired, revoked, unpublished, deactivated, unauthorized, and
  unavailable have distinct safe explanations.
- **AX-DL05:** Push is not the only durable record; audible/haptic feedback has
  in-app visual and accessible equivalents.
- **AX-DL06:** Repeated activation cannot duplicate an underlying action.

## AI and generative UI

### Streaming

- **AX-AI01:** Never announce token by token. Announce generation start once
  and only meaningful buffered state changes.
- **AX-AI02:** Streaming never steals focus or resets reading position.
- **AX-AI03:** Provide persistent **Pause live updates**, **Resume**, and
  **Stop generating**; pausing buffers without loss.
- **AX-AI04:** Stopped/disconnected/failed/rate-limited output retains partial
  content and offers safe retry.
- **AX-AI05:** Completion announces once; final content becomes ordinary
  navigable text with outcome, unresolved items, and decisions summarized.

### Actions, identity, and cards

- **AX-AI06:** Tool state is Queued, Running, Awaiting confirmation, Succeeded,
  Failed, Cancelled, or Partial; announce only transitions.
- **AX-AI07:** Success waits for verified action evidence. Failure names action,
  preserved work, and recovery.
- **AX-AI08:** Retry preserves idempotency context; background progress remains
  inspectable after navigation.
- **AX-AI09:** Human, staff, customer, system, and AI identity is textual and
  semantic, not avatar/color/alignment alone.
- **AX-AI10:** AI never claims it signed, authorized, verified, or completed a
  human/provider action.
- **AX-AI11:** High-risk proposals transfer to human-controlled confirmation
  focused on the summary.
- **AX-AI12:** Dynamic cards match classic names, states, actions, errors, and
  recovery, preserve focus, and announce only meaningful changed state.
- **AX-AI13:** Every card provides a labeled classic route. Unsupported/failed
  rendering falls back to textual result plus safe classic UI with context.

## Chat, realtime, documents, and QES

- **AX-RT01:** Incoming messages announce sender/concise content without
  interrupting critical work; bursts group.
- **AX-RT02:** Typing/presence/read receipts do not create announcement storms.
- **AX-RT03:** Insertion never moves focus or forces latest; a New messages
  control reaches unseen content.
- **AX-RT04:** Order cards announce identity, current canonical status, amount,
  and action; changes announce only changed status.
- **AX-RT05:** Reconnect/sync exposes state and pending/failed count; duplicate
  events produce no duplicate card/announcement.
- **AX-DOC01:** Document cards expose type, number, parties, amount, generation,
  signature, and next action.
- **AX-DOC02:** Required document content has structured selectable
  screen-reader-readable text; a visual PDF alone is insufficient.
- **AX-DOC03:** Tables, totals, requisites, and signatures have linear order.
- **AX-DOC04:** QES preparation names exact document, signer, company, effect,
  and consequence; focus never starts on Sign.
- **AX-DOC05:** Signing does not depend on drawing, drag/drop, visual
  certificate inspection, or color-only status.
- **AX-DOC06:** Pending, signed, rejected, expired, callback-failed, and
  verification-failed states are textual and semantic.
- **AX-DOC07:** Return from the client/system signing flow restores document
  context and announces verified result.
- **AX-DOC08:** Server/AI copy never implies key access. External signing is
  tested with VoiceOver, TalkBack, dynamic text, and switch access.

## Localization and optional charts

- **AX-I18N01:** Visible/accessibility strings share localization sources; no
  hard-coded labels.
- **AX-I18N02:** `uk-UA` and every shipped locale are tested for pronunciation,
  plurals, dates, money, quantities, names, documents, and legal states.
- **AX-I18N03:** Avoid concatenated fragments; expose content language where
  supported; explain ambiguous acronyms.
- **AX-CH01:** Any chart has title, textual summary, exact-value list/table,
  non-color series distinction, meaningful focus order, and reduced motion.
- **AX-CH02:** An inaccessible chart is supplemental to accessible data.

## Component-contract requirements

Every SYSTEM component contract specifies:

1. Variants/states, name source, role/value/actions, and child grouping.
2. Focus lifecycle plus 44×44, keyboard, screen reader, and switch behavior.
3. Dynamic text, contrast, themes, localization, motion, haptic/audio.
4. Operational states, announcements, and AI/classic fallback.
5. Automated assertions, manual checks, and approved exceptions.

A component fails when it lacks name/role, uses color-only state, clips at
200%, traps/moves focus, requires touch, announces tokens/realtime repeatedly,
or has no accessible recovery/classic fallback.

## Verification

Automated checks must:

- Query controls by role/name and assert state/value/actions.
- Reject global font-scaling suppression and unlabeled primitives.
- Measure contrast in every theme and fixture default/200%/maximum text.
- Cover all operational states, form error association/focus, entry intent,
  AI announcement events, realtime deduplication, and document text order.
- Add no dependency without explicit human approval.

Manual checks complete representative journeys:

- On real iOS/VoiceOver and Android/TalkBack devices.
- With keyboard/switch, reduced motion, grayscale/contrast, muted feedback,
  both orientations, software keyboard, and default/200%/maximum text.
- Online, slow, offline, reconnecting, partial failure, and retry.
- In `uk-UA`, pseudo-expanded text, and every shipped locale.
- Through discovery, invite, direct link, auth, cart/checkout, order/chat,
  staff queues, AI, documents, and QES callback.

Record device/OS, artifact version, focus/order, names/roles/states, target
measurements, state/recovery, announcements, and exceptions.

## UX Gate acceptance

- MUST rules reach component contracts and representative classic/AI checks.
- No core journey is blocked by semantics, focus, clipping, confirmation,
  signing, or touch-only interaction; no consequential state is color-only.
- Exceptions/device evidence are recorded as `internal evaluation only`.
- Owner explicitly accepts remaining limitations.

Passing this baseline establishes an internal minimum, not representative
preference or certified WCAG conformance.
