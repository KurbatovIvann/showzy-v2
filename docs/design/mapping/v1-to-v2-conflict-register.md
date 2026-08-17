# V1 mobile → V2 product conflict register

> Status: Owner-approved decisions, 2026-08-17.
> Authority: ADR-0019 and ADR-0020.
> Source: `E:\showzy\apps\mobile` (read-only).

## Dispositions

- **Preserve** — V1 visual and behavioral contract remains canonical.
- **Adapt** — preserve the visible UX while changing logic for V2.
- **Review** — owner approved the boundary but research/spec work remains.
- **Drop** — remove the behavior and its placeholder.

## Access, account, and contexts

| Capability | Disposition | Owner decision |
| --- | --- | --- |
| Anonymous browse | Adapt | Published discovery/company/product/comments, public price, and counters are readable |
| Auth-required actions | Adapt | Social, cart, checkout, chat, and orders require auth; auth sheet resumes the requested action |
| Auth methods | Adapt | Phone/email OTP everywhere; Google on Android only |
| Buyer/seller onboarding | Adapt | Preserve V1 flow; submit through account/company contracts |
| Account profile | Preserve | Avatar, name/username, verified contacts, language/theme, logout |
| Account deletion | Adapt | Add in-app re-auth, consequences, confirmation, and grace period |
| Multiple companies | Adapt | An account may own/join several companies but selects one active company |
| Context switcher | Review | Keep the V1 Profile/More design family; research the exact interaction |
| Company lifecycle | Adapt | Create, edit, publish/unpublish, and archive from mobile |
| Deep links | Adapt | Design all target types now; full web fallback testing arrives with web |

## Discovery and social

| Capability | Disposition | Owner decision |
| --- | --- | --- |
| Likes | Preserve | Desired-state, authenticated product likes with optimistic parity |
| Follows | Preserve | Desired-state, authenticated company follows |
| Comments/replies | Preserve | Author edit/delete, company reply, permissioned staff delete |
| Following tab | Preserve | Private own-user followed companies and liked products |
| Public social identity | Drop | No follower/liker lists, user navigation, profiles, or user search |
| Existing counters | Preserve | Company cards: followers/products; profile: followers; products: likes/comments; account: orders/following |
| Search UX | Adapt | Preserve V1 controls; implement FTS+trigram |
| Popular sort | Adapt | Likes, comments, confirmed orders, and time decay |
| Popular weights/abuse | Review | Define weighting, rate limits, and anti-manipulation in search spec |
| Location | Adapt | City and area filters; no GPS near-me or radius |
| Embeddings/vector search | Drop | No embedding pipeline |
| Company external socials | Preserve | Display, edit, and open external links |
| Native sharing | Adapt | Company/product universal-link share; metadata preview with web |
| Company reviews | Drop | Remove V1 coming-soon placeholder; product comments remain |
| Followed-product notifications | Adapt | Explicit opt-in, after initial notification families |
| Invite auto-follow | Drop | CRM/invite relationship never implies social preference |

## Catalog, commerce, and CRM

| Capability | Disposition | Owner decision |
| --- | --- | --- |
| Product fields | Preserve | Keep V1 media, category, dimensions, weight, volume, price, and stock fields |
| Pricing | Preserve | Five-level resolution, customer groups, public default price, immutable order snapshots |
| Stock | Adapt | Quantity/availability/low threshold; no pending reservation |
| Stock checkout/confirm | Adapt | Block checkout above current stock; atomically revalidate/decrement on confirm |
| Cart/checkout | Preserve | Authenticated synced cart and V1 checkout presentation |
| Delivery | Adapt | Nova Poshta branch/locker/courier plus company pickup |
| Launch payment | Adapt | Invoice/manual details; Monobank acquiring post-launch |
| Customer cancellation | Adapt | Allowed before staff confirmation; later changes use chat |
| Order statuses | Adapt | Fixed machine state; company-customizable labels/colors |
| CRM creation | Adapt | Only checkout, explicit staff creation, or accepted customer invite |
| Pre-CRM chat | Adapt | Authenticated conversation allowed without creating CRM |
| V1 data migration | Drop | V2 starts with an empty database |

## Chat, files, and documents

| Capability | Disposition | Owner decision |
| --- | --- | --- |
| Customer inbox | Adapt | One unified V1-style tab grouped by company context |
| Chat core | Preserve | Realtime text, pagination, retry, typing, presence, read state |
| Chat media | Preserve | Images/files, gallery/edit/share, voice recording/playback |
| Chat interactions | Preserve | Reactions, reply/copy/share/save/edit/delete context actions |
| Product mentions | Preserve | Mentions and product carousel |
| Order/document cards | Adapt | Preserve UI; cards read IDs/revisions and domain actions |
| Conversation recap | Adapt | Same tabs composed from typed domain reads |
| Documents | Preserve | Mobile list/create/generate/view/send flows |
| QES | Preserve | On-device key processing and human signing handoff |
| Offline behavior | Adapt | Cached reads, offline states, idempotent retry after reconnect |
| Uploads | Adapt | Progress, cancel/retry, and resumable/background behavior where supported |

## Staff, integrations, and platform

| Capability | Disposition | Owner decision |
| --- | --- | --- |
| Staff panel | Preserve | Orders, catalog, clients/groups/counterparties/invites, messages, documents, settings, integrations |
| Dashboard/analytics placeholder | Drop | Hide until useful analytics exists |
| RBAC UI | Adapt | Preserve permission-aware UX; authority comes from verified V2 membership |
| Feature gating | Adapt | Preserve locked states through V2 flags/entitlements |
| Integrations | Adapt | Nova Poshta active; approved future integrations may be disabled |
| Meta/Instagram messaging | Drop | No channel, card, placeholder, or backend |
| Notifications | Adapt | Generic event/outbox system; launch with chat/order/document-signing families |
| AI assistant | Adapt | Global text overlay with current context; same actions and safeguards as classic UI |
| Languages | Preserve | Ukrainian and English |
| Themes | Preserve | Light, dark, and system |
| Colors | Adapt | Port V1 palette first; any rebrand is a separate decision |
| Release | Adapt | Public launch requires full agreed parity; incomplete slices use internal flags |

## Research queue

1. Active-company/context-switcher interaction.
2. Popularity weights and abuse resistance.
3. Account-deletion grace period, retention, and company-owner consequences.
4. Future disabled integration cards; no contract exists until approved.
