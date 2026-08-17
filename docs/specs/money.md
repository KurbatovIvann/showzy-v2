# Spec: money, quantity, tax, and snapshot semantics

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Cross-domain value protocol; it owns no tables or actions.

## Representation

- MVP currency is UAH. Persist monetary values as `bigint` minor units and
  expose canonical decimal strings on the wire (`db.md`/`contract.md`).
- Quantity is a signed fixed-scale integer with scale 3 (`quantity_milli`):
  `1` unit = `1000`. Products may restrict allowed increments (for example,
  pieces = 1000; kilograms may use 1). No binary floating-point arithmetic.
- Tax rate is integer basis points (`2000` = 20%). Supported MVP treatments:
  `exempt`, `inclusive`, `exclusive`; allowed rates are validated by the
  owning pricing/document spec rather than a Postgres enum.

## Calculation and rounding

1. Resolve unit price and discount facts.
2. Calculate discounted line basis using integer rational arithmetic.
3. Round each line to one kopiyka using half-away-from-zero.
4. For tax-inclusive pricing, split the rounded gross line into net/tax; for
   tax-exclusive pricing, calculate and round tax then add it to net.
5. Order/document totals are sums of persisted rounded line snapshots, never
   an independently rounded recomputation.

The implementation exposes one pure shared money service with table-driven
vectors. No module reimplements formulas.

## Immutable snapshots

Every order item persists quantity scale/value, unit/base price, discount
kind/value/amount, tax treatment/rate/amount, net, gross, currency, pricing
source IDs, and resolver version. Confirmed order snapshots never change when
catalog/pricing/tax configuration changes.

An amendment creates a versioned adjustment/new item snapshot and audit
entry. A refund references original payment/order lines and accumulates
refunded minor units; it never rewrites original totals. Documents copy the
commercial snapshots they represent and remain immutable after issue/signing.

## Acceptance criteria

- [ ] Golden vectors cover positive/negative adjustments, .5 rounding,
      inclusive/exclusive/exempt tax, fractional quantity, and max safe
      database values.
- [ ] Sum of persisted line net + tax equals gross and order totals exactly.
- [ ] Pricing change after confirmation cannot change an old order/document.
- [ ] Equivalent UI, AI, worker, and retry inputs produce byte-identical
      snapshots.
- [ ] Wire round-trip preserves every 64-bit value without JSON precision
      loss.

## Approved owner decisions

1. Quantity scale 3 and per-product increments.
2. Half-away-from-zero line rounding.
3. Inclusive/exclusive/exempt tax support from MVP (default exempt).
4. Adjustments/refunds append versions; originals remain immutable.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial foundation draft | Close pricing/order money-semantics gap before reference work | GPT-5.6 Sol |
