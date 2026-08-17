# ADR-0020: Public discovery and aggregate-owned social engagement

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: Human owner
- **Amends**: ADR-0013 and ADR-0018

## Context

ADR-0018 restored authenticated consumer discovery but explicitly excluded
anonymous browsing, follows, likes, comments, and social popularity. Review of
the canonical V1 mobile UX showed that these are integrated product behaviors,
not isolated decoration:

- anonymous visitors can evaluate published companies and products before
  signing in;
- company follows and product likes form the private Following collections;
- public counters are part of company and product cards;
- threaded product comments and company replies are part of the product feed;
- follow, like, comment, and confirmed-order activity can support a distinct
  `popular` discovery sort.

The owner has restored those behaviors with narrower boundaries than a social
network: there are no public follower/liker lists, user search, public user
profiles, social activity feed, vector search, or GPS-radius discovery.

The existing principal model must not be weakened. A product or company ID is
a selector, never authority; social activity must not create CRM records; and
anonymous callers must never perform social or commerce writes.

## Decision

### Public and authenticated discovery

Published company/product discovery is available without authentication.
Public results may include:

- company identity, city/area, categories, follower and product counts;
- published product previews, public/default prices, like/comment counts;
- relevance, newest, and popular sorting;
- company/product detail links and readable published comments.

Anonymous users must authenticate before follow, like, comment, cart,
checkout, chat, or order actions. After authentication, mobile resumes the
original requested action.

The `public` principal gains a narrowly defined global-projection read form.
Unlike a single-target public action, it has no target resolver; it may read
only a declared published projection and must declare the projection grant in
the owning spec. The core spec and contract checks must define and validate
this form before a module implements it.

The authenticated `consumer` principal remains read-only and supports
personalized discovery. Neither public nor consumer discovery creates a CRM
record.

### Aggregate ownership

Social data stays with the aggregate that verifies its target:

- `companies` owns company follows and follower counters;
- `catalog` owns product likes, product comments/replies, and their counters;
- `search` owns only event-built discovery projections of public counters and
  ranking signals;
- `notifications` owns notification preferences and deliveries.

There is no separate engagement module.

Company/product mutations use `customer` actions with typed target resolvers
in the owning module. Cross-company own-user collections use `account` reads:

- followed companies;
- liked products.

These collections are visible only to their owner. Public UI exposes counts
but no follower/liker identities or navigation. There is no user discovery.

### Mutation semantics

Follow and like actions set a desired boolean state rather than toggle an
unknown server state. They are safely retryable and emit state-transition
events only when state changes.

Comments support:

- authenticated create and reply on a published product;
- author edit/delete;
- company reply labeling;
- staff deletion with the declared catalog moderation permission.

The server derives the target company from the resolved company/product.
Inputs never grant tenant access. Follow, like, comment, discovery, and
pre-order chat do not create `company_customers` rows.

### Discovery and notifications

Discovery uses FTS and trigram matching. City and area filters remain; vector
embeddings and GPS-radius search remain out of scope.

The `popular` sort may use product likes, comment activity, confirmed orders,
and time decay. Exact weights and abuse controls belong to the search spec.
Confirmed-order counts are ranking inputs, not public counters.

Notifications are designed as an extensible event/outbox projection. Launch
starts with chat, order, and document/signing families. New-product
notifications for followed companies are a later explicit opt-in; accepting
an invite never creates a follow.

### Data and pricing

V2 starts with an empty database. No V1 follows, likes, comments, counters, or
other business history are migrated.

Anonymous product reads show the public/default price. Authenticated
company-scoped reads may return a resolved personalized price. Historical
orders always retain immutable price snapshots.

## Alternatives considered

- **Keep all social behavior dropped** — rejected because it removes visible
  canonical V1 mobile flows and the owner's required Following experience.
- **Create one engagement module** — rejected because target authorization
  belongs with the company/product aggregate; a separate module would need
  pre-context access to foreign tables or duplicate visibility state.
- **Make `consumer` writable** — rejected because it would blur the global
  read-only principal and weaken contract checks.
- **Use `account` writes for foreign company/product targets** — rejected
  because account scope proves ownership of user resources, not visibility
  of another module's aggregate.
- **Expose public follower/liker lists and user profiles** — rejected; public
  counters and private own-user collections satisfy the required UX without
  creating a people-discovery network.
- **Restore V1 embeddings, geo-radius, and follower-only ranking** — rejected;
  the visible discovery controls do not require the legacy implementation.
- **Automatically follow on invite acceptance** — rejected because customer
  relationship and social preference are independent.

## Consequences

- ADR-0018's authenticated-only discovery and “what remains dropped” sections
  must be reworked after this ADR is accepted.
- ADR-0013, the core spec, action metadata, contract checks, and public test
  fixtures must support declared global public-projection reads.
- `scope.md`, module ownership, companies, catalog, search, notifications,
  and design artifacts require owner-controlled rework.
- Companies and catalog gain account/customer/public actions while retaining
  one data path and aggregate-owned authorization.
- Search consumes social and order events idempotently; it never becomes the
  source of truth for counters or order state.
- Required tests include unpublished-target denial, anonymous write denial,
  cross-tenant isolation, own-collection isolation, idempotent retries,
  concurrent counter consistency, comment moderation, no CRM side effects,
  and projection replay.
- Rate limiting and abuse controls are required for public discovery and all
  social mutations.
