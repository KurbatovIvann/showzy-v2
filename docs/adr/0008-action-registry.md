# ADR-0008: Action registry as the single source of truth

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

The product has two parallel interfaces — classic UI and AI chat — that must
be able to do the same things with the same permissions, forever. v1's
assistant ("Shozik") used an ad-hoc allowlist of tables/RPC that drifted from
the UI's capabilities. Agent-written code needs one obvious place where every
business capability lives.

## Decision

Every business operation has one logical action definition: a client-safe
contract descriptor plus exactly one server implementation (contract.md).
It includes Zod input/output, principal/transport mode, permissions, AI metadata
(`aiExposure`, `risk`, `requiresConfirmation`, `idempotent`, `emits`), audit
flag, timeout, and a handler. From it we derive the oRPC procedure, AI tool,
form validation, permission check, and audit log without exposing the server
handler to client bundles.

## Alternatives considered

- **Separate REST controllers + separate AI tool definitions** (v1 model) —
  rejected: guarantees drift between UI and AI capabilities; parity would be
  a convention instead of a physical property.
- **Framework-level abstractions (NestJS guards/pipes)** — rejected with
  NestJS itself (ADR-0003).

## Consequences

- Interface parity is physical: UI and AI call the same handler.
- The contract check in CI can enforce completeness (an action without
  description/principal/transport/permissions/risk or without a paired implementation
  = build error).
- Phase 5 (AI) becomes "connect the LLM to the existing capability graph",
  not a backend rewrite.
