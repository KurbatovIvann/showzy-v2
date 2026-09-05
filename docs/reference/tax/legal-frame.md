# T1 — Legal frame: which tax obligations actually apply

**Status:** first pass complete, primary-text verification outstanding · [SHO-444](https://linear.app/showzy-v2/issue/SHO-444)

Which obligations exist for the businesses we serve, so that the rest of
the workstream studies protocols our customers are actually required to
use. Claim discipline and S/V/C are defined in `README.md`.

**Read the confidence marks.** Most of this pass rests on official ДПС
pages (rates, limits) and reputable secondary sources (the РРО exemption
regime). The operative provisions — ПКУ 296.10 and Article 9 of the РРО
law — have **not** yet been read in primary text; see Open questions.

---

## 1. Returns and cadence for the reference business

Confectionery, sole proprietor on the single tax, groups 2–3.

### Group 2

Fixed monthly single tax, capped at 20% of the minimum wage:
**1,729.40 UAH/month** in 2026. Military levy **864.70 UAH/month** (10% of
the minimum wage), payable monthly by the 20th.

> **S:** ДПС press service, "2026 рік для ФОП: нові розміри єдиного податку та військового збору" — sources.md#dps-2026-rates, published 2026-01-01, read 2026-09-05
> **V:** desk-only (official publication, not exercised)
> **C:** high — the authority's own statement, and it cites the 2026 budget-law figures it derives from (living minimum 3,328 UAH, minimum wage 8,647 UAH)

Declaration is annual, filed within 60 days of year end, with the ЄСВ
annex.

> **S:** secondary accounting press, aggregated — sources.md#reporting-cadence, read 2026-09-05
> **V:** desk-only
> **C:** medium — consistent across sources but not read in ПКУ, and the exact annex designation is unconfirmed

### Group 3

Single tax is a percentage of income rather than a fixed sum: 5% for
non-VAT payers, 3% plus VAT for VAT payers. Military levy 1% of actual
income. Declaration quarterly, within 40 days of quarter end.

> **S:** secondary accounting press — sources.md#reporting-cadence; corroborated against a real accepted filing — sources.md#owner-filing-xml, both 2026-09-05
> **V:** observed — the rates are confirmed by the arithmetic of an accepted return
> **C:** high for the 5% and 1% rates and for the cumulative mechanism; medium for the exact 2026 calendar dates

The filing confirms the computation shape our ledger has to reproduce:
both taxes are calculated on **income for the year to date**, and the
amount payable for the quarter is that figure minus what was already
declared in prior periods of the same year. A quarterly declaration is
therefore not a standalone period — it restates the year and settles the
difference.

### Both groups

ЄСВ for oneself is reported at **1,902.34 UAH/month** minimum (22% of the
8,647 UAH minimum wage).

> **S:** secondary accounting press — sources.md#reporting-cadence, read 2026-09-05
> **V:** desk-only
> **C:** medium — arithmetically consistent with the official minimum wage, but wartime relief and voluntary-payment regimes were not checked

### Income ceilings (2026)

| Group | Annual ceiling | Basis |
| --- | --- | --- |
| 1 | 1,444,049 UAH | 167 minimum wages |
| 2 | 7,211,598 UAH | 834 minimum wages |
| 3 | 10,091,049 UAH | 1,167 minimum wages |

Exceeding the ceiling attracts a 15% rate on the excess and forces a move
to a higher group or to the general system.

> **S:** ГУ ДПС у Донецькій області, "ФОП 2026: ліміти доходу" — sources.md#dps-dn-2026-limits, published 2026-02-25, read 2026-09-05; the 15% consequence from sources.md#dps-2026-rates citing ПКУ 291.4
> **V:** desk-only (official publication)
> **C:** high

## 2. What triggers a РРО/ПРРО obligation

**The decisive finding of this topic.**

The blanket exemption for single-tax payers is gone. ПКУ 296.10, as
reported for 2026, exempts **group 1 only**. Groups 2 and 3 — our
reference profile — have no group-based exemption, and ФОП on the general
system have none at all.

> **S:** secondary accounting and legal press, consistent across four independent sources — sources.md#dtkt-rro-2026, sources.md#rro-exemptions-2026, read 2026-09-05
> **V:** desk-only
> **C:** medium-high — unanimous across sources, but ПКУ 296.10 has not been read in primary text. This claim carries the most weight in the topic and deserves the primary check first.

What remains is not a group exemption but a **payment-method** exemption,
and that is the shape that matters to us:

| How the money arrives | Fiscal receipt required |
| --- | --- |
| Cash | yes |
| Card at point of sale, acquiring, QR | yes |
| Transfer from a non-bank financial institution to the account | yes — reported as changed 2025-03-01 |
| IBAN → IBAN bank transfer | no |
| Services settled exclusively via banking remote services or money-transfer services | no — Article 9(14) of the РРО law |

> **S:** "РРО та ПРРО для ФОПів у 2026 році: повний перелік винятків" — sources.md#dtkt-rro-2026, published 2026-03-10, read 2026-09-05; the Article 9 list also read in summarised form from sources.md#rro-law
> **V:** desk-only
> **C:** medium — the direction is unambiguous and consistently reported; the boundary cases are not. The Article 9 text retrieved was a translated summary with gaps in item numbering, not a verbatim list.

Group 1 additionally retains a market-retail exemption, and reporting
suggests penalty relief for businesses registered in active-combat
territories — both noted, neither load-bearing for our reference profile.

**Why this matters beyond T1.** The obligation turns on *how* money
arrives, not on *whether* it arrived. "Paid" is therefore not a
sufficient model. This is the first confirmed constraint for
[SHO-450](https://linear.app/showzy-v2/issue/SHO-450) — see `impact-now.md`
candidate 1.

## 2a. Practice versus obligation — and the case we build first

Owner testimony, recorded 2026-09-05. It sits here because it redirects the
whole workstream and is not derivable from any legal source.

Among home confectioneries today, income arriving as **cash or card is in
practice not declared**. The owner is explicit that this is not lawful; it
persists because it is not practically observable. Income arriving on the
ФОП current account (**IBAN**) is declared, and for a simplified-system ФОП
that is effectively the whole of tax life: a percentage of receipts to the
account, plus the military levy, and nothing else while under the ceiling.

> **S:** owner, direct testimony — 2026-09-05
> **V:** owner (market practice, not a legal source)
> **C:** high as a description of practice; carries no weight as a statement of law

**Two corrections, so the record stays straight.**

1. The statutory base for a group 3 payer is **all income, whatever the
   channel** — not only bank receipts. "5% of IBAN receipts" describes the
   practical base, not the rule. Our ledger must be able to represent both
   without asserting they are the same number.
2. The ceiling was recalled as roughly 3–5 million. The confirmed 2026
   figures are **10,091,049 UAH** (group 3) and **7,211,598 UAH** (group 2)
   — §1, official ДПС source. The pending change the owner has in mind is
   most likely the VAT draft in §3, which triggers at **1,000,000 UAH** and
   is about VAT registration, not the single-tax ceiling. The two bite at
   turnover levels an order of magnitude apart and should not be conflated.

### What this does to the workstream

The primary case is **IBAN-only**, and per §2 that case requires **no
fiscalisation at all**. Consequences:

- **T3 (ПРРО) leaves the critical path.** It still matters for customers
  who take cash or card and want to be compliant, and Phase 11 acquiring
  would trigger it — but it is no longer the first thing our product meets.
- **T4 (reporting) becomes the critical path**: producing and filing the
  single-tax declaration from a bank-derived income ledger.
- **A new topic is needed**: ingesting bank statements (Monobank,
  PrivatBank) plus manual entry of operations, which is where the ledger's
  raw material actually comes from.

`docs/scope.md:151` already decided that "accounting is built on real bank
transactions, not on orders". The owner's account independently confirms
that decision was right, and raises its priority.

### One design consequence for T7

The product will hold order records — including cash and card orders — and
a bank-derived ledger, and the two will not reconcile. What the ledger is
built from, what an export contains, and what the two surfaces show
side by side are data-model and presentation decisions. They should be made
deliberately in [SHO-450](https://linear.app/showzy-v2/issue/SHO-450),
not fall out by accident.

## 3. VAT registration threshold

Mandatory registration is triggered by taxable supply exceeding
**1,000,000 UAH excluding VAT over the last 12 calendar months**
(ПКУ 181). The application is due by the 10th of the month following the
month in which the threshold was first crossed.

**Single-tax payers of groups 1–3 are currently outside this obligation.**
A group 3 payer may register voluntarily and then pays 3% plus VAT instead
of 5%.

> **S:** ГУ ДПС у Донецькій області — sources.md#dps-dn-2026-limits, published 2026-02-25, read 2026-09-05; the group 1–3 carve-out also appears in the title of an official ДПС Zakarpattia page listed in search results but not opened
> **V:** desk-only (official publication)
> **C:** high for the threshold and the deadline; medium for the exact scope of the carve-out

### Standing risk: the carve-out may not survive

A Ministry of Finance draft published 2025-12-18 would make VAT
registration **mandatory for single-tax groups 1–3** on crossing the same
1,000,000 UAH threshold, targeted to take effect 2027-01-01, with adoption
originally planned for the end of March 2026.

> **S:** secondary accounting press summarising the Ministry draft — sources.md#mof-vat-draft, published 2025-12-18, read 2026-09-05
> **V:** desk-only
> **C:** low on current status — see Open question 1. The proposal is real; **whether it has since been adopted is unverified**. One search summary inferred adoption from the original timetable rather than from evidence; that inference is deliberately not recorded here as fact.

If adopted, VAT stops being an edge case for our customers and becomes the
default at a turnover level many of them reach. That would change the
weight of tax handling in the product, so the status is worth confirming
before T7 concludes.

## 4. ЄСВ obligations

Reported minimum 1,902.34 UAH/month for oneself, filed as an annex to the
annual single-tax declaration rather than as a separate return.

> **S:** secondary accounting press — sources.md#reporting-cadence, read 2026-09-05
> **V:** desk-only
> **C:** medium — the figure is arithmetically consistent with the official minimum wage; the filing mechanics and any wartime relief were not verified

## 5. Primary record-keeping obligations

Goods stock records are governed by Ministry of Finance order **№496 of
2021-09-03**. The obligation attaches not to being a ФОП but to a
combination of tax status or goods category **and** conducting settlement
operations in trade or services. Reported still in force in 2026, with an
appellate decision leaving the obligation standing.

> **S:** secondary accounting and legal press — sources.md#stock-records-496, read 2026-09-05
> **V:** desk-only
> **C:** medium — order number and date are consistently cited; the exact scope for a confectionery is not established, and the order itself has not been read

This is the one obligation whose raw material we already hold: `catalog`
owns products and `orders` owns movements. Worth revisiting in T7 as a
product opportunity, not only a compliance constraint.

## 6. Legal entities on the general system

Not a research question — a scoping decision. The customer spine is the
sole proprietor (`docs/scope.md`, ADR-0028), and every finding above is
framed for that profile.

**Recommendation:** defer legal entities on the general system explicitly.
Their obligations are a different and much larger surface (full
accounting, VAT by default, profit tax), and covering them would multiply
the workstream without serving a customer we have.

_Owner decision pending._

---

## Outcome: segment → obligation → phase

| Customer segment | Mandatory tax surfaces | Trigger | Lands in phase |
| --- | --- | --- | --- |
| ФОП group 1 | none of ours | market retail, within ceiling | — |
| ФОП group 2, cash or card | **ПРРО fiscalisation**; annual return | any non-IBAN settlement | 11 |
| ФОП group 2, IBAN only | annual return | — | 12 |
| ФОП group 3, cash or card | **ПРРО fiscalisation**; quarterly return | any non-IBAN settlement | 11 |
| ФОП group 3, IBAN only | quarterly return | — | 12 |
| Any of the above, VAT-registered | VAT returns | voluntary today; possibly mandatory from 2027 | 12, watch |
| Legal entity, general system | out of scope | — | deferred |

**Reading, revised by §2a.** Legally, a confectionery taking cash or card
owes fiscalisation. In practice that channel is undeclared, and the
business our product is being built for is the **IBAN-only row** — which
owes no fiscalisation and whose entire tax life is a percentage of account
receipts plus the military levy.

So the first tax surface our product meets is **not** ПРРО. It is a
bank-derived income ledger feeding a single-tax declaration. T3 keeps its
value for later (compliant cash/card customers, and Phase 11 acquiring),
but it is no longer first.

## Open questions

1. **Was the VAT draft adopted?** Highest priority. It decides whether VAT
   is an edge case or the default for our customers. Needs a check against
   the parliament register, not the accounting press.
2. **Primary text of ПКУ 296.10 and Article 9 of law 265/95-ВР.** Every
   load-bearing claim in section 2 currently rests on secondary sources.
   `zakon.rada.gov.ua` served only metadata and a lossy summary; a
   different retrieval route is needed.
3. **Does IBAN→IBAN survive a payment link?** If a customer pays through a
   link or QR that ultimately credits an IBAN, is that still outside
   fiscalisation, or does the initiation channel decide? This is exactly
   the flow our product would generate, so the answer is load-bearing for
   Phase 11.
4. **Combat-zone penalty relief** — reported but unverified, and it affects
   real customers.
5. **Stock-record scope for a confectionery** — which goods categories pull
   order №496 obligations.

## Method note

Every `*.tax.gov.ua` host returns HTTP 403 to server-side fetching but
renders normally in a browser. Official ДПС pages are reachable; they just
need the browser route. Recorded in `sources.md` so the next pass does not
rediscover it.
