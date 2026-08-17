# ADR-0001: Full TypeScript stack on Node.js (Go rejected)

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

The backend language for the rewrite was open. Go is frequently praised for
agent-driven development (simple language, fast compile, strong stdlib). The
workload, however, is I/O-bound (chat, orders, webhooks) with heavy Node-only
dependencies: UAPKI WASM (DSTU cryptography), Puppeteer PDF rendering, React
SSR of Plate documents, Socket.IO, Vercel AI SDK.

## Decision

The entire stack is TypeScript (strict) on Node.js 22 — DB schema → API →
clients → AI tools share one type system.

## Alternatives considered

- **Go backend** — rejected: breaks end-to-end type sharing (the strongest
  static guarantee we can give agents), requires duplicating Zod contracts,
  and forces reimplementing or bridging Node-only dependencies (WASM crypto,
  Puppeteer, React SSR). Go's raw performance is irrelevant for an I/O-bound
  workload at our scale.

## Consequences

- One language, one toolchain, one lint/test setup for every package — agents
  move between layers without context switching.
- CPU-heavy work (PDF, crypto) is isolated in workers so the Node event loop
  is not blocked.
