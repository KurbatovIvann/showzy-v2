# V1 mobile UX → V2 capability matrix

> Status: Draft input to spec rework.
> Action names are candidates until the owning spec is approved.

Every client operation uses the action registry. IDs select resources for
verified resolution; they never grant company access.

## Identity and company context

| UX behavior | Owner / candidate capability | Principal | Contract work |
| --- | --- | --- | --- |
| Phone/email OTP | better-auth provider flow | account session | Foundation auth |
| Google sign-in on Android | better-auth provider flow | account session | Platform config |
| Read/update own profile | account profile actions | account | New account/profile spec |
| Change verified contact/username | account verification actions | account | New account/profile spec |
| Delete account | request/cancel/finalize deletion | account/system | Security/account spec |
| Submit buyer onboarding | update profile | account | Account spec |
| Submit seller onboarding | create company + requisites | account | Companies spec |
| List/create owned companies | `companies.listMine/create` | account | Companies rework |
| Select active staff company | verified transport selector | staff | Core/companies |
| Publish/archive company | company lifecycle actions | staff | Companies rework |

## Public discovery and engagement

| UX behavior | Owner / candidate capability | Principal | Contract work |
| --- | --- | --- | --- |
| Browse/search anonymously | `search.discoverPublic` | public global projection | Core + search rework |
| Personalized authenticated browse | `search.discover` | consumer | Search rework |
| Suggestions/filters/sorts | search public/consumer variants | public/consumer | Search rework |
| Open published company | published profile read | public/customer | Companies rework |
| Open published product feed | published product reads | public/customer | Catalog rework |
| See public/default prices | public price resolution | public | Pricing rework |
| See personalized prices | customer price resolution | customer | Pricing rework |
| Follow/unfollow | `companies.setFollow({ followed })` | customer | Companies rework |
| List my followed companies | `companies.listMyFollows` | account | Companies rework |
| Like/unlike | `catalog.setProductLike({ liked })` | customer | Catalog rework |
| List my liked products | `catalog.listMyLikes` | account | Catalog rework |
| Read comments | published comments read | public/customer | Catalog rework |
| Create/reply/edit/delete comment | catalog comment actions | customer | Catalog rework |
| Staff moderate comment | catalog moderation action | staff | Catalog permission |
| Update popular projection | consume catalog/company/order events | system | Search rework |
| Opt into product updates | follow-notification preference | account | Notifications spec |

## Catalog, CRM, pricing, and files

| UX behavior | Owner / candidate capability | Principal | Contract work |
| --- | --- | --- | --- |
| Staff product/category CRUD | catalog actions | staff | Catalog rework |
| Product media upload | create upload/finalize attachment | staff | Files spec |
| Stock and operational fields | catalog stock/product actions | staff | Catalog rework |
| Customer/group CRUD | customers actions | staff | Customers rework |
| Counterparty/legal profiles | customers actions | staff/customer | Customers rework |
| Invite create/share/redeem | invites actions | staff/customer | Invites spec |
| Five-level rule CRUD | pricing actions | staff | Pricing rework |
| Resolve checkout price | pricing read called by orders | system/internal | Pricing/orders |
| Feature/permission facts | feature flags + companies membership | staff | Existing skeleton/rework |

## Cart, checkout, orders, and delivery

| UX behavior | Owner / candidate capability | Principal | Contract work |
| --- | --- | --- | --- |
| Read/update synced cart | cart actions owned by orders | customer | Orders rework |
| Select NP destination | delivery reference reads | customer | Delivery spec |
| Checkout | idempotent order checkout | customer | Orders rework |
| Ensure CRM on checkout | customers internal action | system/internal | Customers/orders |
| Create invoice payment | payments/document composition | system/internal | Payments/documents |
| List/get own orders | `orders.listMine/getMine` | customer | Orders rework |
| Cancel before confirmation | `orders.cancelMine` | customer | Orders rework |
| Staff list/get/create/edit | staff order actions | staff | Orders rework |
| Confirm and decrement stock | unresolved atomic ownership boundary | staff | ADR/spec decision before implementation |
| Update payment/delivery | payment/delivery events | system | Owning specs |
| Render order history | order log read | staff/customer | Orders rework |

## Chat and realtime

| UX behavior | Owner / candidate capability | Principal | Contract work |
| --- | --- | --- | --- |
| Open company conversation | open/get conversation | customer | Chat rework |
| Grouped unified inbox | list own conversations with company facts | account/customer | Chat + companies |
| Staff inbox | list company conversations | staff | Chat rework |
| Send/edit/delete/reply | chat message actions | staff/customer | Chat rework |
| Attachment/voice upload | files upload + chat finalize/send | staff/customer | Files/chat |
| Reactions | set/clear reaction | staff/customer | Chat spec |
| Read state | mark read through sequence | staff/customer | Chat spec |
| Typing/presence | ephemeral realtime protocol | staff/customer | Chat spec |
| Product mention | catalog read + mention metadata | staff/customer | Chat/catalog |
| Order card | order ID/revision projection | system + reads | Orders/chat |
| Document card | document ID/revision projection | system + reads | Documents/chat |
| Recap tabs | orders/catalog/files/documents reads | staff/customer | Principal-compatible reads |
| Offline catch-up | cursor/sequence sync and idempotent send | staff/customer | Chat protocol |

## Documents, notifications, AI, and links

| UX behavior | Owner / candidate capability | Principal | Contract work |
| --- | --- | --- | --- |
| Document list/create/edit | documents actions | staff | Documents spec |
| Generate PDF | request generation + worker result | staff/system | Doc-generation spec |
| Send document to chat | event/card projection | staff/system | Documents/chat |
| Prepare/finalize QES | signing actions around local crypto | staff/customer | Doc-signing spec |
| Download/share artifact | signed file read | staff/customer | Files/doc-signing |
| Register device/preferences | notification device/preference actions | account | Notifications spec |
| Deliver chat/order/document push | consume domain events | system | Notifications spec |
| Invoke from AI overlay | same action descriptors as classic UI | matching principal | Assistant spec |
| Navigate/prefill UI | client-safe AI UI tools | local client | AI/UI contract |
| Resolve deep link | typed public/customer/account target | varies | Owning specs + app shell |

## Protocol requirements for every write

- Zod input/output validation and typed domain errors.
- Mode-appropriate authorization and cross-tenant tests.
- Idempotency for AI invocation, checkout, messages, uploads, documents, and
  other retryable effects.
- Audit for accountable tenant writes; no audit for public/consumer reads.
- Transactional events for cross-module effects.
- Confirmation for destructive/high-risk actions.
- No CRM side effects from discovery, social activity, or pre-order chat.

## Architecture blockers for spec rework

- ADR-0015 permits only read actions through `ctx.call`; an orders action
  therefore cannot synchronously mutate catalog-owned stock. Atomic
  revalidation/decrement on confirmation needs an approved ownership or
  composition decision before either module is implemented.
- ADR-0020 requires core/contract support for global public-projection reads
  before `search.discoverPublic` can exist.
