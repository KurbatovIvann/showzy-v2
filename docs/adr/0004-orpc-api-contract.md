# ADR-0004: oRPC for the API contract

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

Clients (Expo, later Next.js) and the AI layer need end-to-end typed access
to actions. v1 hand-maintained DTO duplicates between NestJS and clients.
External consumers (webhooks docs, future public API) need OpenAPI.

## Decision

oRPC exposes the action registry: every `defineAction` becomes a typed
procedure, and OpenAPI is generated from the same definitions.

## Alternatives considered

- **tRPC** — rejected: same DX but no first-class OpenAPI generation.
- **REST + OpenAPI codegen** — rejected: two sources of truth and a codegen
  step agents can forget.
- **GraphQL** — rejected: needless complexity; resolver flexibility is a
  liability for agent-written code.

## Consequences

- One contract feeds web, mobile, AI tools, and OpenAPI docs.
- Client type errors surface at `tsc` time when an action changes.
