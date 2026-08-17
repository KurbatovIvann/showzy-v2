# Ukrainian Market and Competitor Interaction Audit

> Status: Complete  
> Linear: SHO-6 · Stage: RESEARCH  
> Research snapshot: 2026-08-17

## Method and evidence limits

This is desk research based on public official product pages, help centers,
release notes, and first-party app-store listings. No authenticated product
access or firsthand usability testing was performed.

Evidence labels:

- **Documented:** explicitly supported by a cited official source.
- **Inference:** a likely learned expectation, not direct user evidence.
- **Gap:** the reviewed official sources did not establish the behavior.

Recommendations use:

- **ADOPT:** reuse the interaction principle directly.
- **ADAPT:** reuse it only after fitting Showzy's domain and invariants.
- **AVOID:** do not carry the pattern into Showzy.

Quadrant tags:

- `SC` — staff using classic UI.
- `SA` — staff using AI chat.
- `CC` — customer using classic UI.
- `CA` — customer using AI chat.

Entry tags are `discovery`, `invite`, and `direct-link`. A recommendation
without an entry tag applies after the user has already entered the relevant
company or staff context.

## Instagram

### Official sources

Accessed 2026-08-17:

- [Instagram App Store listing](https://apps.apple.com/us/app/instagram/id389801252)
- [Meta: simplified navigation and Reels-first test](https://about.fb.com/news/2025/09/in-india-instagram-debuts-a-reels-first-experience-for-its-mobile-app/)
- [Meta: 2025 direct-message updates](https://about.fb.com/news/2025/02/new-instagram-dm-features-stay-connected/)
- [Professional-account inbox](https://help.instagram.com/138925576505882/)
- [Message requests](https://help.instagram.com/585369912141614/)
- [Account recovery](https://help.instagram.com/149494825257596/)
- [Notification controls](https://help.instagram.com/124119401075803)
- [Text-size accessibility](https://help.instagram.com/573771026296719/iphone-app-help/)
- [Account safety](https://about.instagram.com/blog/announcements/continuing-to-keep-instagram-safe-and-secure)

The [2019 Instagram Checkout announcement](https://about.instagram.com/blog/announcements/introducing-instagram-checkout)
is historical US closed-beta context only. It is not evidence of general
Instagram-native checkout availability in Ukraine.

### Documented patterns

- **Discovery:** Feed, Reels, Explore, profiles, and shared content lead users
  toward creators, brands, and small businesses.
- **Navigation:** Meta announced a simplified model centered on Reels and DMs,
  but the Reels-first launch cited above was a limited India test. It must not
  be treated as a universal layout.
- **Chat:** DMs support pinned conversations/content, scheduled messages,
  translation, read-receipt controls, and group-chat QR invites.
- **Inbound triage:** professional accounts separate Primary, General, and
  Requests. Unknown or suspected-spam senders are separated from trusted
  conversations.
- **Authentication and recovery:** password, two-factor authentication,
  unfamiliar-access confirmation, login links, security codes, and dedicated
  hacked-account recovery are documented.
- **Notifications:** granular activity and push controls are available.
- **Trust and accessibility:** OS text-size support, verification surfaces,
  impersonation warnings, reporting, blocking, and hidden requests establish
  visible trust boundaries.
- **Gap:** current official sources did not establish a general Ukrainian
  native-checkout flow or a reusable loading/empty/offline state system.

### Likely learned expectations — inference

Ukrainian Instagram users are likely accustomed to:

- Visual discovery opening a business identity or conversation.
- A one-tap path from content to messaging.
- Separation between known conversations and unsolicited requests.
- Visible identity and trust cues before following links or buying.
- Shared content acting as entry context while checkout or operational work
  continues elsewhere.

### Showzy recommendations

- **ADOPT `[CC, CA | discovery, direct-link]`:** use content-rich company and
  product cards with a persistent path to the company conversation.
- **ADOPT `[SC, SA | discovery, direct-link]`:** separate known customers,
  new inbound requests, and suspicious contact without hiding legitimate
  order intent.
- **ADAPT `[CC, CA | invite, direct-link]`:** make shared links preserve the
  company, product, invitation, and intended action through install/sign-in.
- **ADAPT `[CC | discovery]`:** use visual recommendations for relevance and
  commercial clarity, not endless engagement.
- **AVOID `[SC, SA, CC, CA]`:** never let posts or chat messages own order
  state. Cards carry stable IDs and render current domain state.

### Context-copying risks

- Instagram optimizes attention and creator engagement, not completion of
  auditable business work.
- Aggressive request filtering can hide legitimate first-time customers.
- Verification styling creates false confidence unless backed by real
  identity, publication, and tenant checks.
- Region-specific commerce features must not be assumed familiar in Ukraine.

## Telegram

### Official sources

Accessed 2026-08-17:

- [Official applications](https://telegram.org/store/apps?setln=en)
- [February 2026 Android redesign](https://telegram.org/blog/crafting-android-design-and-more/)
- [Telegram FAQ](https://telegram.org/faq)
- [Telegram Business](https://telegram.org/blog/telegram-business)
- [Chat folders and archive](https://telegram.org/blog/folders)
- [Synchronized drafts](https://telegram.org/blog/drafts)
- [Payments 2.0](https://telegram.org/blog/payments-2-0-scheduled-voice-chats)
- [Telegram Stars and physical-product distinction](https://telegram.org/blog/telegram-stars)
- [Mini-app persistence](https://telegram.org/blog/mini-app-bar-paid-media-and-more)
- [Accessibility improvements](https://telegram.org/blog/move-history)
- [Google Play listing](https://play.google.com/store/apps/details?id=org.telegram.messenger)

### Documented patterns

- **Navigation:** the 2026 Android redesign uses a bottom bar for one-tap
  access to major areas. Chat folders become organizational tabs, while
  archive removes inactive conversations from the active queue.
- **Authentication:** accounts use a phone number. Two-step verification,
  recovery email, active-session inspection, and remote session termination
  are available.
- **Business chat:** businesses can configure start pages, hours/location,
  greetings, away messages, quick replies, status tags, bots, and automation.
- **Intent-preserving entry:** business chat links and QR codes can open a
  conversation with a suggested message already inserted.
- **Conversation continuity:** one check indicates cloud delivery; two checks
  indicate the conversation was opened. Drafts and cloud history synchronize
  across devices.
- **Commerce:** bots and mini apps can sell physical goods through third-party
  payment providers. Telegram states that it does not store card details.
- **Notifications:** muted groups may still notify on mentions and replies.
- **Connectivity and accessibility:** official materials emphasize weak-
  connection operation, synchronized history/drafts, and VoiceOver/TalkBack
  improvements.
- **Trust:** passcodes, two-step verification, session management, verified
  system chats, and explicit bot permissions establish security boundaries.
- **Gap:** official sources did not define a consistent general error-state
  visual language.

### Likely learned expectations — inference

Ukrainian Telegram users are likely accustomed to:

- Chat as a primary workspace rather than a support afterthought.
- Links and QR codes opening the exact conversation or intent.
- Automated greeting followed by human continuation.
- Drafts and history surviving device changes.
- Visible unread/delivery state, folders, pins, mute controls, and quick
  actions.
- Bots acting through a recognizably separate business or automation identity.

### Showzy recommendations

- **ADOPT `[SC, SA, CC, CA | direct-link]`:** checkout redirects to the exact
  conversation with an order card, stable order ID, current state, and next
  action.
- **ADOPT `[CC, CA | invite, direct-link]`:** preserve intent such as “ask
  about product X” or “continue order Y,” while resolving authorization
  independently on every action.
- **ADOPT `[SA, CA]`:** persist drafts, show send/retry state, and support
  cross-device continuation.
- **ADOPT `[SC, SA]`:** provide conversation folders or filters for new,
  waiting-on-customer, risky-action, and completed work.
- **ADAPT `[SA, CA]`:** identify AI and human turns clearly and provide an
  explicit escalation/ownership handoff.
- **ADAPT `[SA, CA]`:** turn bot-style buttons into typed actions; risky
  actions open a confirmation summary.
- **AVOID `[SC, SA, CC, CA]`:** do not imply end-to-end encryption unless the
  actual Showzy protocol provides it.

### Context-copying risks

- A chat-only shell can bury structured catalog, document, and operational
  tasks.
- Suggested-message links are selectors, never authorization grants.
- Automation may obscure who made a consequential decision.
- Telegram payment/privacy guarantees do not transfer to Showzy.

## monobank

### Official sources

Accessed 2026-08-17:

- [Ukrainian App Store listing](https://apps.apple.com/ua/app/monobank-digital-mobile-bank/id1287005205)
- [Security](https://monobank.ua/security)
- [Payment-link creation](https://monobank.ua/knowledge-base/acquiring/online/links/create)
- [Payment-link status](https://monobank.ua/knowledge-base/acquiring/online/links/status)
- [Tap-to-phone payment and refund](https://monobank.ua/en/knowledge-base/acquiring/offline/taptophone/ios)
- [Open banking and consent](https://monobank.ua/en/openbanking)
- [Tap to Pay accessibility and privacy](https://monobank.ua/en/terminal/tap-to-pay)

### Documented patterns

- **Scope:** one mobile app exposes cards, activity, payments, transfers,
  business functions, marketplace, insurance, and support. Public sources do
  not document the exact current tab architecture.
- **Onboarding:** phone confirmation plus identity verification through Diia
  or identity documents; a virtual card follows registration.
- **Confirmation:** amounts, rates, limits, fees, and installment terms appear
  before final confirmation.
- **State:** transfer and payment status remains inspectable in the app.
- **Merchant links:** businesses can create payment links or QR codes, send
  them in chat, and distinguish paid from awaiting-payment links. Documented
  links remain valid for 72 hours.
- **Risk controls:** enhanced 3D Secure uses the protected application channel
  rather than an ordinary SMS-only approval.
- **Recovery:** refunds can be full or partial and require confirmation.
  In-app support is available.
- **Accessibility:** the app listing declares VoiceOver, Larger Text, dark
  interface, Reduced Motion, and differentiation without color alone.
- **Trust:** PCI DSS, TLS, biometrics, anti-fraud monitoring, visible terms,
  protected confirmation, QES, and regulatory identity are foregrounded.
- **Gap:** no offline transaction promise or general loading/empty-state
  convention was established by the reviewed sources.

### Likely learned expectations — inference

monobank is likely to have trained Ukrainian users to expect:

- Fast phone-and-Diia onboarding.
- Complex financial tasks completed entirely on mobile.
- Exact amount, recipient, fee, and consequence before confirmation.
- Strong separation between preparation and irreversible approval.
- Immediate status plus recoverable transaction history.
- Friendly language that does not hide financial seriousness.

### Showzy recommendations

- **ADOPT `[SC, SA, CC, CA]`:** use context-rich confirmation with actor,
  company, object, amount/effect, destination, and reversibility.
- **ADOPT `[SC, SA, CC, CA]`:** expose pending, succeeded, failed, and reversed
  states with idempotent retry.
- **ADOPT `[SC, SA, CC, CA]`:** show consequences before payments, document
  signing, order confirmation, or destructive changes.
- **ADAPT `[CC, CA | discovery, invite]`:** use phone verification or Diia
  only at the assurance level required; discovery must not inherit bank-grade
  KYC friction.
- **ADAPT `[SC, SA, CC, CA]`:** use warm feedback, but keep consequential
  confirmations plain and accessible.
- **AVOID `[SC, SA]`:** never use a bare push “Allow” as the only approval for
  sensitive staff or AI actions.

### Context-copying risks

- Banking trust cannot be acquired by copying visual polish.
- Bank-grade confirmation on every low-risk action creates fatigue.
- Context-poor push approval is vulnerable to habituation and social
  engineering.
- Marketplace breadth does not justify undifferentiated Showzy navigation.

## Nova Poshta

### Official sources

Accessed 2026-08-17:

- [App Store listing](https://apps.apple.com/ua/app/nova-post/id1644647080)
- [New mobile application overview](https://novaposhta.ua/en/new-mobile-application/)
- [Tracking](https://novaposhta.ua/tracking/)
- [Parcel-locker flow and offline recovery](https://novaposhta.ua/en/receive/at-parcel-locker/)
- [Safe-service guidance](https://novaposhta.ua/safeservice/)
- [Official SMS authorization](https://my.novaposhta.ua/auth/checkDevice)
- [Nova Poshta Online payments](https://online.novaposhta.ua/)

### Documented patterns

- **Home as work queue:** shipments can be sorted, filtered, split into “to
  me/from me,” and archived.
- **Authentication:** the official personal-cabinet flow uses phone plus SMS
  code. It is supporting context, not proof that every app step is identical.
- **Object cards:** each parcel exposes status, movement, and state-dependent
  actions such as redirect, alternate recipient, return, payment, courier
  contact, or rescheduling.
- **Contextual communication:** courier chat/call appears in a specific
  delivery context rather than as a general inbox.
- **Notifications:** shipment updates and courier-arrival alerts are backed by
  an in-app notification center. Safe-service notices remain visible even when
  OS push is disabled.
- **Bounded offline path:** a parcel-locker flow can be prepared and paid
  online, then opened offline with Bluetooth and location.
- **Recovery:** permission checks, retry guidance, and contact-center
  escalation are explicit when a locker fails.
- **Privacy:** public tracking may state that detailed information is
  unavailable because of privacy restrictions.
- **Trust:** official guidance says legitimate payment notices contain no
  payment link and payment occurs inside “My Shipments.”
- **Gap:** reviewed sources did not establish specific screen-reader or
  reduced-motion support.

### Likely learned expectations — inference

Ukrainian Nova Poshta users are likely accustomed to:

- A live object queue as the home screen.
- Concise status plus only currently valid actions.
- Push backed by durable in-app history.
- Clear next steps after plans or delivery state change.
- Narrow offline support for critical physical-world moments.
- Payment-sensitive actions returning to the trusted app.

### Showzy recommendations

- **ADOPT `[SC, SA, CC, CA]`:** render status-first order, payment, delivery,
  and document cards with state-dependent actions.
- **ADOPT `[SC, SA, CC, CA]`:** make in-app notifications authoritative and
  push a delivery mechanism only.
- **ADOPT `[SC, SA, CC, CA]`:** attach chat/cards to orders, delivery,
  payments, and documents rather than duplicating domain state.
- **ADOPT `[SC, SA, CC, CA]`:** recovery identifies the failed prerequisite,
  preserves progress, offers retry, and then escalation.
- **ADAPT `[SC, CC]`:** permit offline access only for bounded, safely cached,
  already-authorized tasks.
- **ADAPT `[SA, CA | direct-link]`:** open risky chat actions on an
  authenticated Showzy confirmation surface.
- **AVOID `[SC, SA, CC, CA]`:** do not copy a mostly linear parcel state model
  for collaborative orders or multi-party documents.

### Context-copying risks

- Logistics is more linear than collaborative order/document work.
- A notification center becomes noise without grouping and priority.
- Offline actions expose stale state unless safely replayable.
- SMS-only identity is insufficient for high-risk staff, payment, or QES work.

## Poster

### Official sources

Accessed 2026-08-17:

- [Terminal overview](https://joinposter.com/ua/tour/terminal)
- [Working with the POS](https://knowledge-base.joinposter.com/uk-ua/how-to-work-with-pos)
- [Order list and processing](https://knowledge-base.joinposter.com/uk-ua/how-to-take-orders-and-work-with-order-list-on-your-pos-register)
- [POS synchronization](https://knowledge-base.joinposter.com/uk-ua/how-pos-sync-works)
- [PRRO without internet](https://knowledge-base.joinposter.com/uk-ua/how-to-operate-prro-when-the-venue-has-internet-issues)
- [Fiscalization recovery](https://knowledge-base.joinposter.com/uk-ua/how-to-correct-fiscalization-mistakes-with-prro-2.0)
- [Mobile waiter](https://joinposter.com/ua/tour/mobile-pos)
- [iOS listing](https://apps.apple.com/ua/app/poster-tablet-pos/id691098784)
- [Android listing](https://play.google.com/store/apps/details?id=com.joinposter&hl=uk)
- [Poster Boss listing](https://play.google.com/store/apps/details?id=com.poster_manage.app&hl=uk)

### Documented patterns

- **Task-focused POS:** the active check and product menu dominate the
  workspace. Restaurant floor/table concepts can be enabled or disabled.
- **Order queue:** staff filter by order type, status, and date; search by
  order/customer identity; and execute the next status action.
- **Progressive navigation:** reports, cash operations, and settings remain
  behind secondary navigation.
- **Split management surfaces:** browser admin configures the catalog; POS
  consumes synchronized data; Poster Boss provides read-oriented management.
- **Customer entry:** QR menu, bill payment, tips, and reviews can work without
  a customer app.
- **Onboarding:** account setup, terminal credentials, employee PIN, opening
  balance, shift opening, and a guided test sale are documented.
- **Payments/fiscalization:** cash, card, certificates, bonuses, mixed
  payments, QR payment, and explicit PRRO controls are available.
- **Notifications:** Telegram bots, courier notifications, and shift-close
  owner notifications are documented.
- **Connectivity:** a persistent sync indicator distinguishes synchronized
  from disconnected states. Orders remain locally usable and synchronize
  after reconnect, but online orders and cross-terminal sync stop offline.
- **Recovery risk:** documentation warns against clearing cache, reinstalling,
  restarting, or switching devices while unsynchronized.
- **Gap:** reviewed docs did not establish a general loading or empty-state
  system.

### Likely learned expectations — inference

Ukrainian hospitality users are likely accustomed to:

- Persistent shift, order, and synchronization state.
- One dominant next action per operational status.
- Fast employee switching after terminal login.
- Continuity during unstable connectivity.
- Explicit warning when local data has not synchronized.
- QR/direct-link entry without installing an app.

### Showzy recommendations

- **ADOPT `[SC, SA]`:** show plain-language sync state and pending count, for
  example “3 changes awaiting sync.”
- **ADOPT `[SC]`:** use status-grouped work queues with one dominant next
  action and searchable customer/order identity.
- **ADOPT `[CC, CA | direct-link]`:** let QR or links open the exact catalog,
  order, invoice, or conversation.
- **ADAPT `[SC]`:** convert dense POS layouts into role-specific mobile
  workspaces without restaurant-only tables or shifts.
- **ADAPT `[SA, CA]`:** AI operates on the same order/catalog objects and
  deep-links to their classic detail surfaces.
- **AVOID `[SC]`:** never make recovery depend on remembering not to clear a
  cache or change devices.
- **AVOID `[SC]`:** do not use color as the only synchronization meaning.

### Context-copying risks

Poster is optimized for high-frequency hospitality POS work. Its density,
floor map, shift model, and immediate fiscalization overfit Showzy's broader
micro-business audience. A separate management app would also fragment
Showzy's dual-flow model.

## Checkbox

### Official sources

Accessed 2026-08-17:

- [Mobile application instructions](https://wiki.checkbox.ua/uk/app/mobile/instruction)
- [Getting started](https://wiki.checkbox.ua/uk/home)
- [PRRO end-to-end guide](https://checkbox.ua/blog/yak-pratsyuvaty-z-prro/)
- [Tap to Phone](https://wiki.checkbox.ua/uk/instructions/acquiring/taptophone)
- [Release history](https://wiki.checkbox.ua/uk/update)
- [iOS listing](https://apps.apple.com/ua/app/checkbox-%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BD%D0%B8%D0%B9-%D1%80%D1%80%D0%BE/id6449941861)
- [Android listing](https://play.google.com/store/apps/details?id=ua.in.checkbox&hl=uk)

### Documented patterns

- **Main workspace:** shift state, cash balance, product entry, and the current
  receipt are visible together.
- **Secondary navigation:** returns, cash operations, deferred receipts,
  history, reports, printer, support, and settings use a side menu.
- **Onboarding:** web setup creates trade point, register, cashier, and KEP
  state before mobile cashier login. A test register supports rehearsal.
- **Receipt creation:** products can be searched, scanned, or entered manually.
  Gestures edit/remove lines; discounts apply to a line or receipt.
- **Device-local drafts:** deferred receipts preserve partial work but are not
  recoverable after device loss or replacement.
- **Payment/fiscalization:** cash, card, custom, mixed, payment-link, QR, and
  Tap to Phone flows are documented. Payment and fiscalization may require
  separate steps.
- **Electronic receipt delivery:** print, file, link, SMS, Viber, and email
  are supported.
- **Offline fiscal operation:** reserve fiscal codes allow bounded offline
  work and upload after reconnect. Only cash remains available offline.
- **Recovery:** users monitor remaining offline capacity and confirm that
  receipts reach the tax service. Support and app logs are directly available.
- **Gap:** public mobile docs emphasize procedural troubleshooting rather than
  a consistent contextual loading/empty/error model.

### Likely learned expectations — inference

Users familiar with Ukrainian PRRO products are likely accustomed to:

- Fiscal and payment success as separate inspectable states.
- Daily shift and visible register balance.
- Receipt history with retry/recovery.
- Electronic receipt sharing through familiar channels.
- Clear offline legal/payment limits.
- Setup language aligned with ДПС and KEP concepts.

### Showzy recommendations

- **ADOPT `[SC, SA]`:** separate order, payment, document, and fiscal state;
  “paid” must not imply “fiscalized.”
- **ADOPT `[SC]`:** provide a safe test path for payment/document workflows.
- **ADOPT `[SC, CC | direct-link]`:** share documents and receipts through
  authenticated direct links and familiar channels.
- **ADAPT `[SC]`:** reveal fiscal concepts only where required; do not make
  PRRO shifts global navigation for invoice/manual-payment launch flows.
- **ADAPT `[SA]`:** AI may prepare fiscal/document actions but must show legal
  effect, target, and confirmation.
- **AVOID `[SC]`:** do not store business-critical drafts only on one device.
- **AVOID `[SC, SA]`:** do not copy optional cloud-key signing; Showzy QES keys
  remain client-side.

### Context-copying risks

Checkbox mirrors statutory entities and fiscal operations. Copying its
hierarchy would make ordinary catalog/chat/order work bureaucratic. Its
cloud-signature option conflicts with Showzy's client-side QES invariant.

## Horoshop

### Official sources

Accessed 2026-08-17:

- [Admin-panel overview](https://help.horoshop.ua/uk/articles/8837956-%D1%88%D0%B2%D0%B8%D0%B4%D0%BA%D0%B8%D0%B9-%D0%BE%D0%B3%D0%BB%D1%8F%D0%B4-%D0%B0%D0%B4%D0%BC%D1%96%D0%BD-%D0%BF%D0%B0%D0%BD%D0%B5%D0%BB%D1%96)
- [Mobile page configuration](https://help.horoshop.ua/uk/articles/5144532-%D0%BD%D0%B0%D0%BB%D0%B0%D1%88%D1%82%D1%83%D0%B2%D0%B0%D0%BD%D0%BD%D1%8F-%D1%81%D1%82%D0%BE%D1%80%D1%96%D0%BD%D0%BE%D0%BA-%D0%BC%D0%BE%D0%B1%D1%96%D0%BB%D1%8C%D0%BD%D0%BE%D1%97-%D0%B2%D0%B5%D1%80%D1%81%D1%96%D1%97)
- [Catalog and order capabilities](https://horoshop.ua/ua/functions/orders/)
- [Order processing](https://help.horoshop.ua/uk/articles/1703603-%D0%BE%D0%B1%D1%80%D0%BE%D0%B1%D0%BA%D0%B0-%D0%B7%D0%B0%D0%BC%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D1%8C)
- [Customer account](https://help.horoshop.ua/uk/articles/12928619-%D0%BE%D1%81%D0%BE%D0%B1%D0%B8%D1%81%D1%82%D0%B8%D0%B9-%D0%BA%D0%B0%D0%B1%D1%96%D0%BD%D0%B5%D1%82-%D0%BF%D0%BE%D0%BA%D1%83%D0%BF%D1%86%D1%8F)
- [Mobile action notifications](https://help.horoshop.ua/uk/articles/10302005-%D1%81%D0%BF%D0%BE%D0%B2%D1%96%D1%89%D0%B5%D0%BD%D0%BD%D1%8F-%D0%BF%D1%80%D0%BE-%D0%B4%D1%96%D1%97-%D0%BD%D0%B0-%D1%81%D0%B0%D0%B9%D1%82%D1%96)
- [Online-payment modes](https://help.horoshop.ua/uk/articles/3711707-%D1%80%D0%B5%D0%B6%D0%B8%D0%BC%D0%B8-%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%BE%D0%BF%D0%BB%D0%B0%D1%82-%D0%B4%D0%BB%D1%8F-%D0%BF%D0%BE%D0%BA%D1%83%D0%BF%D1%86%D1%96%D0%B2)

No first-party Horoshop mobile-app listing was found in the reviewed official
pages or app-store searches. This is a search finding, not proof that none
exists in every market.

### Documented patterns

- **Customer storefront:** mobile blocks, category navigation, filters,
  product cards/detail, cart, and account can be configured separately.
- **Staff navigation:** a browser admin left rail covers Start, Orders,
  Clients, Products, Site, Discounts, Marketing, Analytics, and Settings.
- **Onboarding:** staff get a launch checklist with deep links. Customer
  accounts can be explicit or automatically created after an order.
- **Catalog/checkout:** dynamic search, filters, variants, availability,
  wishlist, comparison, cart, and quick order are documented.
- **Quick order:** minimal contact data starts a request; a manager completes
  payment and delivery later.
- **Order processing:** New → In progress → payment/delivery work →
  Sent/Delivered/Cancelled, with possible integration-driven status updates.
- **Payments:** immediate checkout or manager-confirmed deferred payment.
  Deferred mode creates an order-specific reusable payment link.
- **Notifications:** actionable transient mobile messages plus email/SMS for
  order/payment/status changes; staff may contact customers through familiar
  messengers from order details.
- **Recovery:** unfinished payment remains accessible by order-specific link;
  out-of-stock and delivery-failure states are explicit.
- **Gap:** no documented offline storefront/admin behavior or complete
  loading/empty-state system was found.

### Likely learned expectations — inference

Ukrainian e-commerce users are likely accustomed to:

- Search/category/filter → product card → detail → cart → checkout.
- Minimal-data order requests when a seller will confirm details manually.
- Recognizable order history and status.
- Immediate or deferred payment through an order-specific link.
- Email/SMS/messenger communication around order progress.
- Recovery of unfinished payment from the order record.

### Showzy recommendations

- **ADOPT `[CC, CA | discovery]`:** use familiar
  search/filter/detail/cart conventions; AI discovery links to the same
  products and cart.
- **ADOPT `[SC, SA, CC, CA | direct-link]`:** make pending payment durable and
  recoverable from an order-specific link.
- **ADOPT `[SC]`:** use a first-run checklist with deep links and visible
  completion.
- **ADAPT `[CC]`:** reinterpret quick order as a transparent request whose
  price, availability, or delivery may still need confirmation.
- **ADAPT `[SC]`:** turn wide admin tables into mobile queues, compact cards,
  filters, and saved views.
- **AVOID `[SC, CC]`:** do not maintain separate semantic desktop/mobile
  content trees that silently diverge.
- **AVOID `[CC]`:** do not create an account silently; explain ownership,
  authentication, and recovery.

### Context-copying risks

Horoshop optimizes one merchant's web storefront, not authenticated
cross-company discovery or conversational ordering. SEO architecture and
manager-mediated quick order must not define Showzy's global discovery model.

## Cross-product synthesis

### Highest-value combined journey

1. Instagram-like discovery opens a precise company/product context.
2. Telegram-like intent-preserving links continue into the correct
   conversation or action.
3. Horoshop-like catalog conventions make browsing and cart behavior familiar.
4. Nova Poshta/Poster-style cards and queues show current operational state.
5. monobank-style confirmation separates proposal from consequential action.
6. Checkbox-style separation prevents payment, fiscal, and document state from
   collapsing into one misleading “done.”

### Foundation patterns to adopt

- **One domain object across channels `[SC, SA, CC, CA]`:** classic UI, AI
  chat, notification, and direct link open the same product, order, payment,
  invoice, or document.
- **Actionable work queues `[SC, SA]`:** mobile cards grouped by state, one
  primary next action, search, and saved filters.
- **Context-preserving entry `[CC, CA | discovery, invite, direct-link]`:**
  after install/sign-in, return to the exact authorized company/product/order
  target.
- **Explicit asynchronous state `[SC, SA, CC, CA]`:** distinguish local draft,
  submitted, awaiting confirmation, awaiting payment, paid, document/fiscal
  processing, completed, failed, and reversed where applicable.
- **Durable notification center `[SC, SA, CC, CA]`:** push transports an event;
  Showzy retains inspectable state and recovery.
- **Resilient recovery `[SC, SA, CC, CA]`:** explain the failed prerequisite,
  preserve progress, offer safe retry, then escalation.
- **Accessible trust `[SC, SA, CC, CA]`:** confirmation and sync state use
  text/icon/structure, never color alone.

### Patterns to adapt carefully

- **AI as an action surface `[SA, CA]`:** public competitor evidence for
  general AI operations is weak. Use structured previews, permission-aware
  confirmation, result cards, and deep links back to classic UI.
- **Progressive legal complexity `[SC, SA]`:** expose QES, fiscal, and document
  controls only when relevant without losing auditability.
- **Bounded offline behavior `[SC, CC]`:** cache only safely authorized,
  replayable tasks and show last-known state/pending actions.
- **Quick order `[CC, CA]`:** preserve the low-friction request but make staff
  confirmation, account ownership, price, and availability explicit.
- **Inbound triage `[SC, SA]`:** protect staff from spam without hiding genuine
  first-contact customers.

### Patterns to avoid

- Chat, cards, notifications, or email owning copied domain status.
- Channel-dependent truth or recovery.
- Device-only drafts for business-critical work.
- Suggested links or message content treated as authorization.
- Confirmation without actor, tenant, target, effect, and consequence.
- Color-only status and opaque synchronization.
- Bank-grade friction on low-risk discovery.
- Restaurant/fiscal concepts becoming global navigation.
- Separate mobile and desktop information structures that drift.
- Claims of encryption, verification, payment safety, or AI authority that
  the Showzy protocol does not actually provide.

## Implications for later stages

### DEFINE

- IA should combine familiar customer catalog navigation with staff work
  queues and contextual chat.
- Journey maps must preserve target and intent through discovery, invite,
  direct link, sign-in, checkout, chat, notification, and retry.
- Content principles need canonical Ukrainian status terms and plain
  consequences for confirmation, offline state, and failure.

### SYSTEM

- Component contracts need explicit async, offline, retry, confirmation,
  suspicious/inbound, and partial-success states.
- Cards need stable domain identity, state, timestamp, primary action, and
  accessible status semantics.
- Notification, direct-link, and AI-result components must resolve current
  domain state rather than display a stored snapshot.

### PROTOTYPE and internal evaluation

- Test at least one complete discovery → company → cart → checkout → chat
  transition.
- Test staff queue triage and order next-action clarity.
- Test AI → classic confirmation and classic → AI continuation.
- Include pending, duplicate tap, partial success, offline, retry, expired
  link, unpublished product/company, and suspicious inbound states.
- Record the limitation `internal evaluation only`; this audit does not
  establish representative Ukrainian-user preference.
