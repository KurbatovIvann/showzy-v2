# ADR-0003: Hono as the HTTP framework

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

The v1 audit showed almost everything heavy (Socket.IO, BullMQ, Puppeteer,
WASM, outbox) lives outside the HTTP framework; the framework is a thin
routing wrapper. Agent-written code benefits from explicit flow with no
hidden behavior.

## Decision

Hono (`@hono/node-server`) is the HTTP layer. Routing only — business logic
lives in the action registry mounted via oRPC.

## Alternatives considered

- **NestJS (v1)** — rejected: decorators and DI hide the flow from agents;
  guards/pipes/interceptors are reproduced by the action registry in ~10×
  less code.
- **Fastify** — rejected: solid, but its plugin/hook model is Node-idiomatic
  rather than fetch-native; Hono's web-standard `Request`/`Response` aligns
  with the rest of the stack (oRPC, AI SDK) and makes SSE, raw-body webhooks,
  and streaming proxies trivial.
- **Encore** — rejected: framework-shaped vendor; our workload doesn't fit
  its managed-primitives model. Its valid lesson is kept: durability
  decisions are fixed by the architecture, not left to the agent.

## Consequences

- The three flows where the framework matters (assistant SSE, Meta webhook
  raw body, PKI streaming proxy) are simpler than in v1.
- No framework-level DI: dependencies are passed explicitly (visible to
  agents, trivial to test).
