# V1 → V2 mobile port findings

> **Archived 2026-08-21.** Findings from the superseded ADR-0019 V1 port.
> **Not authority.** Visual acceptance is the Magic Patterns canvas
> ([`mp-to-mobile.md`](../../../design/mapping/mp-to-mobile.md)). Product
> dispositions that are still useful live in
> [`v1-to-v2-conflict-register.md`](../../../design/mapping/v1-to-v2-conflict-register.md).

> Status: Archived list. Rows were `proposed` until the owner set a disposition.

Add a row when a port discovers a Class B/C issue (or a Class A theme gap
that needs a new token name). Do not silently ship Class C.


| Status     | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `proposed` | Agent or review found it; V1 behavior stays until disposition |
| `accepted` | Owner approved the change; implement in its own PR            |
| `rejected` | Keep V1; do not raise it again without new evidence           |
| `shipped`  | Accepted change is in `apps/mobile`                           |




## Seeded from V1 screen review (2026-08-19)

These came from the V1 screenshot pass. They are **not** approved fixes.


| ID   | V1 locus                                            | Issue                                                                   | Class | Proposal                                                                          | Status     |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------- | ---------- |
| PF-1 | Staff orders/products/clients list cards            | Tall Edit-style cards waste density compared with a compact row         | C     | Keep V1 cards until the owner picks compact rows vs cards                         | `proposed` |
| PF-2 | Customer tab bar, Profile                           | Profile uses a gear/settings glyph; the tab is the person, not Settings | C     | Keep the V1 glyph until the owner picks Person vs gear                            | `proposed` |
| PF-3 | Following / company row actions                     | Unsubscribe competes with Message as a primary action                   | C     | Keep V1 hierarchy until the owner ranks Message vs unfollow                       | `proposed` |
| PF-4 | Forms (auth, checkout, staff CRUD)                  | Labels are not persistently visible once a value is filled              | C     | Keep V1 labeling until the owner asks for always-visible labels                   | `proposed` |
| PF-5 | Muted foreground on canvas (`#7A7570` on `#F0EDE7`) | Pairing is likely under the accessibility contrast baseline             | B     | On port, check contrast; if it fails, adjust the muted role in theme (no rebrand) | `proposed` |
| PF-6 | Some list rows (chat, documents)                    | Destructive trash control is always visible                             | C     | Keep V1 until the owner asks to hide trash behind swipe/overflow                  | `proposed` |
| PF-7 | Customer orders list                                | No search/filter, unlike several staff lists                            | C     | Keep V1 until the owner asks for search on that list                              | `proposed` |
| PF-8 | Layout at tablet width                              | V1 is phone-first; launch depth for tablet is unset                     | C     | Ship phone parity first; tablet master–detail is a later owner decision           | `proposed` |




## Found during port

| ID     | V1 path                                      | Issue                                                                                          | Class | Proposal                                                                                          | Status     |
| ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------- | ---------- |
| PF-9   | `components/screens/auth/sign-in-content.tsx` | Google sign-in is Android-only in the conflict register; T49 is OTP-only (ADR-0006)            | C     | Keep OTP as the phase-0 sign-in; add Google Android in a later auth-provider ticket               | `proposed` |
| PF-10  | `components/screens/auth/sign-in-content.tsx` | “Continue without account” contradicts mandatory accounts (scope §1.1)                         | C     | Omit guest entry on the T49 screens; public discovery remains unauthenticated by principal, not guest mode | `proposed` |


