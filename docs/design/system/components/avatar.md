# Avatar Contract

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-16 · Supporting visual identity

## Use and interface

Use for optional recognition of person, company, system, or AI when textual
identity is also present. Never use as the only authorship, role, company,
presence, permission, or verification indicator.

Conceptual inputs: entity kind; safe display name; authorized image reference;
initials/company/person/system/AI fallback; public/context-restricted/concealed
privacy; compact/default/prominent size; optional named action; adjacent-text
flag; optional non-authoritative presence hint.

Person/company uses authorized media or safe fallback. System/AI uses distinct
mark plus text. Concealed identity uses neutral fallback without derived
initials. Interactive avatars have a separate 44×44 target.

## Behavior and content

- Loading/failure never blocks adjacent identity; failure switches to fallback.
- Presence/role/online require adjacent text and semantics, not ring/color.
- Non-interactive avatar is hidden from focus when adjacent text duplicates it.
- Interactive avatar names its action, not merely the identity.
- Fallback initials derive only from safe name using locale-aware rules.
- Never expose private names, membership, or role outside current authorization.
- AI/system/human authorship remains explicit in text.
- Offline cached media respects current privacy; revoked identity is not
  reconstructed from stale data.

## Dual-flow, accessibility, and tokens

Classic uses account/company/conversation attribution. AI distinguishes AI,
system result, and accountable human without implying authority. Staff/Customer
follows company access; Global uses public-safe identity.

If adjacent identity exists, image is decorative; otherwise expose concise
identity/entity kind. Support meaningful alternatives, 3:1 boundary/focus,
44×44 interaction, keyboard/switch/screen-reader, 200%, grayscale, reduced
motion.

Use `colors.semantic.surface|text|border|context`, `typography.role.label`,
`dimensions.icon.*`, `radii.pill`, and `motion.*` from `tokens.md`.

## Acceptance

Authorship survives hidden images/grayscale; failed/concealed/privacy states
leak nothing; interactive avatar works across all input modes.
