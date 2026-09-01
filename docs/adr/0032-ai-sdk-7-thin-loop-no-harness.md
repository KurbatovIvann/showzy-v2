# ADR-0032: AI loop is AI SDK 7; no coding harness

- **Status**: Accepted
- **Date**: 2026-09-01
- **Deciders**: Ivan Kurbatov (human) (+ proposing agent)

## Context

Blueprint §3 named **Vercel AI SDK v6** as the AI layer before `packages/ai`
existed. Phase 9 is “connect the LLM to the existing capability graph”
(blueprint §4, scope §7): tools are `transport: client` +
`aiExposure: exposed` descriptors; writes go through `executeAction`; HITL
is core.md §7; audit already records `channel: "ai"`.

By 2026-09-01 AI SDK **7** is the current major (GA 2026-06-25). It requires
Node.js 22 and ESM — already true here. Starting Phase 9 on v6 would force
an immediate major migration.

The 2026 market also sells **harnesses**: runtimes that put a model in a
computer-like environment (shell, files, sandboxes, plugin DI, subagents).
DeepSeek Harness (`dsh`), Claude Agent SDK, and Google ADK 2.0 are that
class. Shozee’s environment is the staff action registry inside one company,
not a filesystem.

## Decision

The AI **loop** is **Vercel AI SDK 7**: workspace package `packages/ai`
depends on `ai@7` and exactly one first `@ai-sdk/<provider>` (Anthropic,
OpenAI, or Google). Optional `@ai-sdk/react` on clients for `useChat` +
Expo `expo/fetch`. Exact patch versions land in the lockfile at first
install (Phase 9 feature); docs pin the **major**.

The SDK only: talks to models, streams UI-message parts (Hono SSE mount),
and runs a tool loop. `tool()` adapters wrap existing action descriptors;
`execute` calls `executeAction` with `channel: "ai"`. Conversation rows
belong to the `assistant` module. Confirmation stays core.md §7
(`toolApproval` may pause the model loop; it does not replace the Redis
challenge).

Provider choice (Claude / GPT / Gemini / DeepSeek) is config, not a runtime
swap. Additional providers are extra `@ai-sdk/*` packages later.

**Not in this pin:** Vercel AI Gateway as a required path; `WorkflowAgent`,
embeddings, MCP Apps, sandboxes, speech/realtime in the first slice.

## Alternatives considered

- **Stay on AI SDK v6** — rejected: current major is 7; Node 22/ESM already
  match v7; a greenfield package should not start one major behind.
- **Mastra / LangGraph.js / Genkit** — rejected: second tool registry,
  memory, RAG, or workflow runtime. Ownership is already ADR-0008 +
  assistant tables + outbox.
- **`@google/genai` as the app loop** — rejected: vanilla Gemini client.
  If Gemini is the first model, use `@ai-sdk/google` so stream/tools stay
  one protocol.
- **Google ADK 2.0** — rejected: graph/multi-agent harness (Vertex/A2A).
- **DeepSeek Harness (`dsh`)** — rejected: coding-agent OS (Cordis plugins
  with `inject`, bash, file editor, Code mode, preview Web UI). Developer
  preview with promised breakages. DeepSeek-the-model may still be a later
  provider.
- **Claude Agent SDK / OpenAI Agents SDK** — rejected: vendor harness or
  multi-agent handoffs; built-in computer tools fight tenant isolation.
- **Raw provider SDKs only** — rejected: we would reimplement the tool loop
  and UI-message stream. Keep provider SDKs as transitive deps of
  `@ai-sdk/*`.

## Consequences

- Blueprint §3 and README say **AI SDK 7**, not v6. ADR-0001 still names
  the SDK as a Node-only reason for TypeScript; this ADR pins the major
  and the loop-vs-harness boundary.
- Phase 9 must not add a coding harness or a second action/tool registry.
- `/rpc` stays `channel: "ui"` (security-operations §4). The AI mount sets
  `channel: "ai"`.
- Switching off AI SDK 7 to another loop library needs a new ADR.
