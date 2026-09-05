# T8 — Bank statement ingestion: Monobank, PrivatBank, manual entry

**Status:** first pass complete · [SHO-451](https://linear.app/showzy-v2/issue/SHO-451)

Step 1 of `target-flow.md`: where the income ledger's raw material comes
from. Claim discipline and S/V/C are defined in `README.md`.

Everything below is read from vendor documentation, not exercised against a
live account. Confidence is high on **shape** — endpoints, fields, limits
as published — and lower on behaviour under load, error cases, and anything
the docs are silent about.

---

## The decisive constraint: we must use Monobank's provider API

Monobank's personal API documentation states the rule directly. Paraphrased
from the page:

- A service that connects centrally to serve its clients **must** use the
  providers API.
- The corporate API is unnecessary only when client data does not pass
  through the developer's servers — a personal tool, a family project, or a
  library the client runs themselves.
- The bank reserves the right to sanction a company found exploiting the
  personal API as a corporate one.

Showzy is a hosted service; client statement data lands on our servers. So
the personal-token route — the one every hobby project uses, with its
`X-Token` header — **is not available to us**. We use the providers API.

> **S:** Monobank open API (v250818), preamble — sources.md#mono-personal, read 2026-09-05
> **V:** desk-only (vendor's own documentation)
> **C:** high — it is the bank's stated policy, in the bank's own words, and it names the sanction

This is the single most important finding of this topic. Building against
the personal API because it is easier would put the product at risk of
losing bank access entirely.

---

## Monobank — providers API

**Version observed:** `v260831`.

> **S:** Monobank open API for providers — sources.md#mono-corporate, read 2026-09-05
> **V:** desk-only
> **C:** high for the published surface; unknown where the docs are silent

### Request authentication

Every authorised call is signed. Headers: `X-Key-Id` (our service key id),
`X-Request-Id`, `X-Time` (UTC seconds), and `X-Sign`. The signed string
varies by endpoint — `X-Time | URL` for company-level calls,
`X-Time | X-Request-Id | URL` for client-data calls. The key is
**secp256k1**, registered as a PEM public key at onboarding.

So this is not a bearer token: we hold a private key and sign each request.
That has consequences for key storage and for how we test.

### Onboarding the company (one-off, human-gated)

| Step | Endpoint |
| --- | --- |
| Submit an authorisation application | `POST /personal/auth/registration` |
| Poll its status | `POST /personal/auth/registration/status` |
| Set the callback URL | `POST /personal/corp/webhook` |
| Read our own company settings | `GET /personal/corp/settings` |

The application carries `pubkey`, company name, a free-text description of
the service and why it needs the API, contact person, phone, email, and a
logo. Status moves from `New` to `Approved`, at which point a `keyId` is
issued.

**This is a bank approval, not a signup.** Lead time is unknown and not
documented; it is the first thing to start, because nothing else can be
tested until it clears. Flagged as open question 1.

### Onboarding a client (per company, repeatable)

| Step | Endpoint |
| --- | --- |
| Create an access request | `POST /personal/auth/request` |
| Check whether the client approved | `GET /personal/auth/request` |

The create call returns `tokenRequestId` and an `acceptUrl` on `mbnk.app`,
which the client opens to approve. The request is **valid for 24 hours**.
An optional `X-Callback` header gives us a URL the bank calls once the
client consents, so we do not have to poll. Before approval, the status
check returns `401`.

This is a clean consent model and it maps well onto our product: the owner
presses "connect Monobank", approves in their own banking app, and we hold
the grant.

### Reading data

| Purpose | Endpoint |
| --- | --- |
| Client and account list | `GET /personal/client-info` |
| Statement | `GET /personal/statement/{account}/{from}/{to}` |

`from` and `to` are Unix seconds; `account` is an account id from
client-info, or `0` for the default UAH account. **Maximum window: 31 days
plus one hour (2,682,000 seconds).**

Historical backfill therefore has to be chunked into ≤31-day windows. The
personal API documents a hard rate limit of one request per 60 seconds; the
providers documentation does not repeat that figure but does define `429`
responses. Whether the provider limit is the same, looser, or per-client is
**not documented** — open question 2, and it directly determines how long a
first-time backfill takes.

### Transaction fields

```
id              stable identifier — use for idempotent ingestion
time            Unix seconds
description     bank-generated description
mcc             merchant category code
originalMcc
hold            whether the amount is still on hold
amount          minor units, signed: negative is a debit
operationAmount amount in the operation's own currency
currencyCode    ISO 4217 numeric — 980 is UAH
commissionRate
cashbackAmount
balance         balance after the operation
comment         payer's own comment
receiptId
counterEdrpou   counterparty entity code
counterIban     counterparty account
counterName     counterparty name
```

`counterIban`, `counterEdrpou` and `counterName` are the fields that make
classification tractable. `comment` carries what the payer typed, which for
a confectionery is often the only signal of what was bought.

### Webhooks

`POST /personal/corp/webhook` registers one callback URL for the whole
service. The bank sends a test `POST` when it is set and fails the call if
the URL does not answer `200`.

The personal API documents delivery behaviour in detail — events shaped as
`{type:"StatementItem", data:{account, statementItem}}`, retries after 60
and 600 seconds, and the webhook **switched off after a third failed
delivery**. Whether the providers webhook behaves identically is not stated;
assume it might, because the consequence of being wrong is silent data loss.
Open question 3.

### monoКЕП — unexpected, and relevant later

The providers API also exposes document signing:
`POST /personal/signature/create`. Up to 10 documents per application,
`oneSigner` defaulting to true, an optional `callbackUrl` for status, an
application lifetime of **3 days**, and a deeplink the user opens in the
monobank mobile app to sign. Hashing follows ГОСТ 34.311-95, with a
reference implementation linked from the docs.

Phase 1 signs with a file key by owner decision, so this is not on the
critical path. But a sole proprietor who already banks with Monobank
signing a declaration inside the app they use daily is a materially better
experience than handling a key file on a phone. Recorded for
[SHO-445](https://linear.app/showzy-v2/issue/SHO-445) to evaluate after
phase 1.

---

## PrivatBank — Автоклієнт API

> **S:** PrivatBank business integration page and the published Автоклієнт API specification — sources.md#privat-autoclient, read 2026-09-05
> **V:** desk-only
> **C:** medium-high — the specification is published as a document rather than a versioned API reference, so drift is harder to detect

**Base URL:** `https://acp.privatbank.ua`

### Access model — different from Monobank

A **token issued by the client** in Приват24 для бізнесу, in the Автоклієнт
settings, and passed as a `token` header alongside `User-Agent`. There is no
provider registration and no bank approval of our company: the client
generates a token and hands it over. Reportedly the token grants
**view-only** rights over statements, which is the right shape for us.

Free for sole proprietors on any tariff; legal entities need a higher tier.

This is the model accounting software already uses, so it is well-trodden —
but "the client pastes a token into our product" is a different security and
consent posture from Monobank's approved-provider flow, and whether
PrivatBank's terms permit a SaaS to hold that token server-side needs
confirming rather than assuming. Open question 4.

### Endpoints

| Purpose | Endpoint |
| --- | --- |
| Balances | `GET /api/statements/balance` |
| Transactions | `GET /api/statements/transactions` |
| Interim / final variants | `.../interim`, `.../final` |
| Service status | `GET /api/statements/settings` |

Parameters: `acc` (optional — all active accounts when omitted),
`startDate` and `endDate` as `DD-MM-YYYY`, `followId` for pagination, and
`limit` (default 20, maximum 500, with ≤100 recommended). Pagination comes
back as `exist_next_page` and `next_page_id`.

No maximum date range is documented, which is a pleasant contrast with
Monobank's 31 days — but absence of a documented limit is not the same as
absence of a limit.

### Transaction fields

```
AUT_MY_NAM                own name
AUT_MY_ACC                own account
AUT_CNTR_NAM              counterparty name
AUT_CNTR_ACC              counterparty account
OSND                      purpose of payment — the free-text field
SUM                       amount
CCY                       currency, e.g. UAH
TRANTYPE                  "C" credit or "D" debit
DAT_OD                    value date
DATE_TIME_DAT_OD_TIM_P    timestamp, DD.MM.YYYY HH:MM:SS
REF + REFN                concatenated, forms the unique transaction id
```

Note the differences from Monobank that a shared ledger model has to absorb:
direction is a **field** (`TRANTYPE`) rather than the sign of the amount;
currency is an **alphabetic code** rather than ISO numeric; dates are
formatted strings rather than Unix seconds; and the unique id is a
**concatenation of two fields**.

### No webhooks

The API is polling-only. Combined with Monobank's webhook, this forces a
design where **scheduled polling is the baseline for every provider** and a
webhook is an optimisation that shortens latency where it exists. Building
webhook-first and bolting on polling later would be the wrong order.

TLS 1.0 and 1.1 are refused; 1.3 recommended.

---

## The hard part: what counts as declarable income

Both banks tell us who sent money, how much, and what the payer wrote.
**Neither tells us whether it is taxable income.** That judgement is ours,
and getting it wrong produces a wrong declaration.

Credits that are *not* income include at least: the owner's own transfers
between their own accounts, loan or credit proceeds, refunds received, and
money returned by a customer after a cancelled order. Nothing in either
payload distinguishes these reliably — a transfer from the owner's personal
card to their ФОП account is, structurally, an ordinary credit with a
counterparty name that happens to be the owner.

Available signals: counterparty account and entity code, counterparty name,
the free-text purpose or comment, direction, amount, and — Monobank only —
MCC.

So the model has to be **rules plus confirmation**, not classification
alone:

- default to a rule (for example, credits from an account the owner has
  marked as their own are excluded);
- let the owner correct any transaction, and remember the correction as a
  rule for that counterparty;
- keep the classification decision on the transaction as data, with who
  decided it and when, because it is the basis of a filed declaration and
  may be questioned later.

What this research cannot decide, and should not: whether the product asks
the owner to review every unclassified credit before filing, or files on
defaults and lets them correct afterwards. That is a product question for
[SHO-450](https://linear.app/showzy-v2/issue/SHO-450), and it deserves a
deliberate answer because the failure modes differ — nagging versus a wrong
return.

### Currency

Both APIs return non-UAH operations. A receipt in foreign currency has to
enter a UAH ledger at some defined rate on some defined date, and that rule
is a tax rule, not a banking one. Not covered here — handed to
[SHO-444](https://linear.app/showzy-v2/issue/SHO-444) as a new question.

---

## Manual entry

Manual entry is the route for every owner who does not connect a bank, and
per `target-flow.md` it must produce **the same ledger**, not a lesser one.

To do that it has to capture at minimum: date, amount, currency, direction,
counterparty name, purpose, and the classification decision. That is
comfortably enough to feed a declaration, and it is a short form.

Two things follow that are easy to get wrong:

1. **Manual and imported operations must coexist without double counting.**
   An owner who enters operations by hand for two months and then connects
   the bank will re-import the same period. Imported rows carry stable
   provider ids (`id` for Monobank, `REF`+`REFN` for PrivatBank); manual
   rows need their own identity and a way to be reconciled or superseded
   rather than silently duplicated.
2. **A ledger that has been filed against is not freely editable.** Once a
   declaration is submitted for a period, changing the underlying figures
   means a correction, not an edit — see
   [SHO-447](https://linear.app/showzy-v2/issue/SHO-447) question 4.

---

## Ingestion design, as the evidence points

Not a decision — the shape the evidence supports, for an ADR to confirm:

- **Polling is the baseline**, on a schedule, per connected account. It is
  the only mechanism PrivatBank offers and the only safe fallback when a
  Monobank webhook is disabled after failed deliveries.
- **Webhooks shorten latency where available**, and must be treated as an
  optimisation that can silently stop.
- **Backfill is chunked** — ≤31-day windows for Monobank, paginated for
  PrivatBank — and is a long-running job, not a request.
- **Ingestion is idempotent on the provider's transaction id**, which both
  banks supply in a stable form.

That maps onto the existing worker and outbox rather than needing anything
new, which is worth confirming in T7 rather than assuming.

---

## Open questions

1. **What is the lead time and acceptance bar for Monobank provider
   approval?** Nothing can be tested until it clears, so it is the long pole
   and should be started early. — owner
2. **What is the providers-API rate limit?** The personal API documents one
   request per 60 seconds; the providers documentation defines `429` but not
   the threshold. It decides how long a first backfill takes. — agent, or
   ask the bank
3. **Does the providers webhook disable itself after three failed
   deliveries**, as the personal one does? If yes, the polling fallback is
   not optional. — agent
4. **Do PrivatBank's terms permit a SaaS to hold a client's Автоклієнт
   token server-side?** The accounting-software precedent suggests yes, but
   precedent is not permission. — agent, then confirm with the bank
5. **Does PrivatBank have any provider-level programme** equivalent to
   Monobank's, or is the client-issued token the only route? — agent
6. **Is there a documented maximum date range on PrivatBank statements?**
   Undocumented is not unlimited. — agent
7. **How does Taxer classify incoming transactions**, and what do its users
   complain about? Prior art on the one genuinely hard problem here. — agent
