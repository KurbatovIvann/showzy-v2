# Ukrainian tax service (ДПС) — integration reference

Archaeology of a system we do not own. This tree records **what is true
about the tax side**, so that a future implementer does not have to
rediscover it, and so that a claim made today can be re-checked against
the date it was made.

Workstream: [SHO-443](https://linear.app/showzy-v2/issue/SHO-443/research-ukrainian-tax-service-dps-integration-surface).

## What this is not

Not a spec and not a plan. ADR-0023 retired `docs/specs/<module>.md` and
`docs/plans/<module>.md`; the executable contract of a feature is
`*.contract.ts` plus its tests. Nothing here designs our API, names our
tables, or decides product behaviour. When research surfaces an
architectural question — "who owns a fiscal receipt?" — the answer is a
new ADR, not a section in this tree.

It is also not tax advice, to us or to our users. It documents obligations
and protocols as they exist.

## Why it exists before Phase 11/12

`docs/scope.md:151` makes financial data a **phase 0 requirement**:
amounts, currency, and payment↔order↔document links are designed now.
Fiscalisation (Phase 11) and accounting (Phase 12) are post-launch, but
the model that must survive them is being written today. `impact-now.md`
is the deliverable that pays for this research; the rest is its evidence.

## Claim discipline

Tax rules change by наказ. An undated claim becomes a landmine two phases
later. Every load-bearing statement carries a block:

```
> **S:** source and section — see sources.md#<key>, fetched YYYY-MM-DD
> **V:** desk-only | cabinet | test-env | prod
> **C:** high | medium | low — and why
```

- **S** — where it came from. Every source is registered in `sources.md`.
- **V** — how far it was verified. `desk-only` means read, not exercised.
  `cabinet` means seen in the Електронний кабінет with a real key.
  `test-env` and `prod` mean a request was actually made.
- **C** — how much weight it carries, and the reason for the discount.

**Anything still at `V: desk-only` is re-verified before implementation,
not trusted.** A block without S/V/C is a draft note, not a finding.

## Topics

| File | Linear | Status |
| --- | --- | --- |
| `legal-frame.md` | [SHO-444](https://linear.app/showzy-v2/issue/SHO-444) | in progress |
| `kep-signing.md` | [SHO-445](https://linear.app/showzy-v2/issue/SHO-445) | not started |
| `prro-fiscal-api.md` | [SHO-446](https://linear.app/showzy-v2/issue/SHO-446) | not started |
| `reporting-api.md` | [SHO-447](https://linear.app/showzy-v2/issue/SHO-447) | not started |
| `registers.md` | [SHO-448](https://linear.app/showzy-v2/issue/SHO-448) | not started |
| `vendors.md` | [SHO-449](https://linear.app/showzy-v2/issue/SHO-449) | not started |
| `impact-now.md` | [SHO-450](https://linear.app/showzy-v2/issue/SHO-450) | not started |

Supporting: `glossary.md` (Ukrainian terms), `sources.md` (source register).

## How work lands here

Branches `research/tax-<topic>`, touching only `docs/reference/tax/**`.
Docs-only, so they never conflict with mainline feature work and CI is
trivially green. Never mixed into a code PR, and never one long-lived
branch — small increments, merged fast.

A finding is not recorded until it is in this tree. Linear comments are
working notes, not the archive.

## Secrets

A real ФОП qualified key backs some of this research. It stays with the
owner, on the owner's machine. No key file, password, PIN, certificate
serial tied to a real person, or signed payload belongs in this tree.
