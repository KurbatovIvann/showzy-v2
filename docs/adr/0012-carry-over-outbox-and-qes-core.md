# ADR-0012: Carry over the outbox pattern and the QES crypto core

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

Two parts of v1 are proven and expensive to rebuild: (1) the transactional
outbox (`domain_events`, claim via `FOR UPDATE SKIP LOCKED`, LISTEN/NOTIFY
poller); (2) `@showzy/document-signing` — UAPKI-based DSTU cryptography
(WASM web/node, Nitro native), ASiC-E packaging, with tests and signing
vectors. But v2 changes the surrounding architecture (auth, storage, module
system), so "carry over as-is" would smuggle in stale assumptions.

## Decision

- The **outbox pattern** carries over structurally unchanged; only the
  consumer changes — module subscriptions via the event bus in
  `packages/core` instead of v1's monolithic 1,400-line processor.
- For **QES**: the verified cryptographic core carries over unchanged
  (bindings, ASiC-E, tests, signing vectors). The integration surface —
  storage access, auth context, module wiring — is re-audited and rewritten
  against the v2 architecture. Behavior and crypto carry over; architecture
  does not automatically carry over.

## Alternatives considered

- **Rebuild both from scratch** — rejected: the outbox is textbook-correct;
  the crypto core is verified against real CAs, and DSTU crypto is the worst
  possible place to introduce fresh bugs.
- **Carry the signing package as-is** — rejected: it embeds v1 assumptions
  (Supabase storage/auth) that no longer hold.

## Consequences

- v1 signing tests and vectors are imported as the acceptance suite for the
  v2 integration.
- Human-in-the-loop remains mandatory for signing: AI prepares, a human
  confirms (blueprint §4).
