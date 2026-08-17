# Input Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-16 · Text-entry component

## Use and interface

Use for text, search, OTP, and multiline drafts. Use selection controls for
finite choices and text components for read-only facts.

Conceptual inputs: persistent localized label; single/search/OTP/multiline kind;
controlled value; input mode; required/optional; idle/focused/validating/
invalid/disabled/read-only state; hint/error; secure-entry; applicable Change,
Submit, and Clear actions.

Search has a named Clear. OTP is one logical paste/autofill value. Multiline
wraps/grows or scrolls without hiding actions. Secure input has a named
visibility control. Embedded controls retain 44×44; no fixed text height clips
200% text.

## Behavior and content

- Placeholder never replaces label.
- Invalid/failed states preserve input and associated error until corrected.
- Failed submit focuses summary or first invalid field above the keyboard.
- Focus order is label, field, help/error, then actions.
- Search Clear and secure visibility are separately focusable.
- Keyboard dismissal never submits/discards.
- Label names the fact; hint gives format/constraint before entry; error names
  field, problem, and correction without blame/codes.
- Offline may preserve a labeled draft but blocks current-authority operations.

## Dual-flow, accessibility, and tokens

Classic covers auth, search, forms, filters, drafts. AI covers composer and
focused clarification; dense delivery/legal/high-risk data returns to classic.
Staff/Customer retain company context; Global search has no company authority.

Expose native role, name, value, required/read-only/invalid, and associated
hint/error. Permit paste/assistive input and support keyboard, switch,
screen-reader, 200%/bold/expanded text, both orientations, reduced motion.

Use `colors.semantic.surface|text|border|focus|status`, relevant
`typography.role.*`, `space.*`, `dimensions.touch.minimum`, `radii.*`, and
`motion.*` from `tokens.md`.

## Acceptance

Persistent labels, OTP paste/autofill, search Clear, multiline reflow,
associated errors, 44×44 controls, preserved retry input, and software-keyboard
behavior pass.
