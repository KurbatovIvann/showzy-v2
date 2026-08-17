# ADR-0010: Mobile-first client strategy

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

The primary user (small business owner) runs their business from a phone.
Conversion via web storefront matters later, not for the MVP. Product
decision confirmed by the owner: build all MVP functionality in the mobile
app; web comes after, connected via universal links.

## Decision

Expo app is the primary client carrying the complete MVP: owner panel,
customer cabinet, chat, orders, documents, AI chat. Next.js web (storefront
SEO, browser cabinet, desktop template editor) is a post-MVP phase (6).

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
- Anonymous orders are out (account required) — aligned with the
  security-over-conversion product decision.
