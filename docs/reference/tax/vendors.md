# T6 — Direct integration versus an intermediary provider

**Status:** fiscalisation decided; reporting still open · [SHO-449](https://linear.app/showzy-v2/issue/SHO-449)

---

## Decision: fiscalisation goes through a provider

If and when we support fiscalisation, it will be an integration with a
provider such as Checkbox. **We will not implement the ДПС fiscal server
protocol ourselves.**

> **S:** owner decision — 2026-09-05
> **V:** owner (a decision, not a finding)
> **C:** firm for now; the owner's wording leaves it open to revisit, but
> nothing in the current evidence argues against it

### Why this holds up

Three things line up behind it, so it is not a decision made against the
research:

1. **The primary customer does not need it.** `legal-frame.md` §2a: our
   first case settles by IBAN and owes no fiscalisation at all. Building
   the protocol would serve nobody we have.
2. **The protocol is the expensive kind.** Offline mode with reserved
   fiscal number ranges, shift state that outlives a request, an error
   taxonomy where some failures leave the shift unusable, and version
   churn driven by наказ. That is a lot of surface to own for a feature
   that is not on the critical path.
3. **Signature handling comes with it.** Direct fiscalisation would drag
   the QES questions in T2 into a high-frequency path, rather than the
   low-frequency filing path where they actually belong.

### What this does not decide

Choosing a provider. That is a later exercise against the criteria in
[SHO-449](https://linear.app/showzy-v2/issue/SHO-449) — API quality,
pricing, white-label terms, where the receipt legally sits, and whether we
could migrate off without the client re-registering. It becomes live when
fiscalisation becomes live, most likely with Phase 11 acquiring.

### What still leaks into our model

A provider absorbs the protocol, not the concepts. Even fully behind
Checkbox or an equivalent, our data model has to hold:

- a **reference to a fiscal document** (its number and status) on whatever
  our side considers the payment or the order;
- the **payment channel**, since that is what decides whether a receipt is
  owed at all (`impact-now.md` candidate 1, already confirmed);
- enough of the **failure states** to show a user that fiscalisation was
  attempted and did not complete.

What we do *not* need to model, because the provider owns it: shift
lifecycle, fiscal number reservation, offline queueing. That is a real
narrowing of `impact-now.md` candidate 3 — worth recording, because it
removes long-lived state from our side of the boundary.

---

## Still open: does the same logic apply to reporting?

The fiscalisation decision raises the obvious question for the surface
that *is* on the critical path. Filing the single-tax declaration can
plausibly go the same way — services in this market already file on a
client's behalf — or it can be ours, which is what "replacing Taxer"
normally implies.

This is not decided, and it changes how deep
[SHO-447](https://linear.app/showzy-v2/issue/SHO-447) needs to go:

| If filing is ours | If filing goes through a provider |
| --- | --- |
| T4 must cover document format, submission channel, and the квитанція state machine in full | T4 shrinks to the provider's API and its acknowledgement model |
| T2 (QES) is on the critical path — we must solve signing | the provider's signing arrangement becomes the question instead |
| we own form-version churn | the provider absorbs it |

Note that the second column does not remove the QES problem, it relocates
it: something still has to sign the declaration with the client's key, and
`kep-signing.md` question 3 — whether unattended delegated signing is
permissible at all — is the same question either way.

_Owner decision pending._

## Vendor evaluation

_Not started. Becomes live when fiscalisation does, or sooner if the
reporting question above is answered in favour of a provider._
