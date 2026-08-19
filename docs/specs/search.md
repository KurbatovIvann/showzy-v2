# Spec: search

> Status: Living.
> Active surface: none.
> Density beyond the declared slice is intent, not contract; do not treat unimplemented sections as frozen.
> Written against blueprint §2.1, §5, §7; scope §2.2, §7; ADR-0013, ADR-0014,
> ADR-0015, ADR-0018, ADR-0020; `docs/module-ownership.md`.
>
> **Owner-first launch (2026-08-19):** the first product release is the
> company panel (staff/AI). Customer cabinet, public storefront, consumer
> discovery, and the business-chat platform are **Deferred: customer
> expansion** — named capabilities only, not a freeze and not launch work.
> This entire module is customer expansion. Do not implement it as
> owner-first launch work.

## 1. Purpose

The `search` module owns **global FTS/trigram discovery projections** of
published companies and active published products. It provides
`consumer`-principal actions for text search, category-filtered browsing, and
search suggestions (ADR-0018 / ADR-0020).

It explicitly does **not** own: company or product domain data (`companies`,
`catalog`), pricing, CRM, business-category taxonomy (`companies`), files, or
any social/follower/embedding data (dropped). Search is a **projection**,
never the source of truth (blueprint §2.1, invariant 5). It never emits
domain events.

## 2. Owned tables (named; specify columns when the slice is built)

| Table | Intent |
| --- | --- |
| `search_companies` | Denormalized published companies; FTS + trigram; no geo, embeddings, or social counters |
| `search_products` | Denormalized active published products of published companies; no prices in discovery cards |

Extensions `pg_trgm` / `unaccent` already exist (`docs/specs/db.md`). Grants
from `companies` / `catalog` publication events are declared when this slice
is specified for build.

## 3. Actions (Deferred: customer expansion)

| Action | Principal | Intent |
| --- | --- | --- |
| `search.discover` | `consumer` | Text search / browse published companies and products |
| `search.suggest` | `consumer` | Type-ahead |
| `search.refreshCompanyProjection` | `system` | Upsert/delete company projection from company events |
| `search.refreshProductProjection` | `system` | Upsert/delete product projection from catalog events |
| `search.rebuildAll` | `system` | Maintenance rebuild |

Do not add embeddings, GPS-radius, or social ranking.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-19 | Collapsed the discovery novel to named Living intent. Module is customer expansion, not owner-first launch. | Owner-first launch; `/spec` density | owner |
| 2026-08-17 | Initial draft | Spec-rework queue Step 3c: full search module | spec agent |
