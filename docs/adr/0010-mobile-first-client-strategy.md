# ADR-0010: Mobile-first client strategy

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

The primary user (small business owner) runs their business from a phone.
Conversion via web storefront matters later, not for the MVP. Product
decision confirmed by the owner: build all MVP functionality in the mobile
app; the full web client comes after.

## Decision

Expo app is the primary client carrying the complete MVP: owner panel,
customer cabinet, chat, orders, documents, AI chat. Next.js web (storefront
SEO, browser cabinet, desktop template editor) is a post-MVP phase (6).
MVP nevertheless includes minimal iOS Universal Links and Android App Links
for invites, company links, order/chat notifications, and QES callbacks. If
the app is not installed, these links open a small install landing page;
browser continuation of the product flow remains phase 6.

## Alternatives considered

- **Web-first** (typical SaaS default) — rejected: contradicts observed user
  behavior of the target persona.
- **Parallel web + mobile from day one** — rejected: doubles surface area
  during the phase where the pipeline and patterns are still stabilizing.

## Consequences

- Document template editing on mobile needs a research spike (Expo DOM
  components — scope §9).
- API/contract must stay client-agnostic so the web phase adds no backend
  changes.
- Link ownership files, route parsing, install fallback, and callback
  allowlists are phase-0 foundation work; they are not a second product UI.
- Anonymous orders are out (account required) — aligned with the
  security-over-conversion product decision.
