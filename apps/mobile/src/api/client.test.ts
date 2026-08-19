import { defineActionContract } from "@showzy/core/contract";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildContractRouter } from "@showzy/contract";

import { createShowzyClient } from "./client";

const ping = defineActionContract({
  name: "sample.ping",
  description: "Fixture read used only by the mobile client wiring test.",
  principal: "staff",
  transport: "client",
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: true,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
  permissions: ["sample:view"],
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
});

const sampleRouter = buildContractRouter({ sample: { ping } });
type SampleRouter = typeof sampleRouter;

async function ignoreRpcFailure(promise: Promise<unknown>): Promise<void> {
  await promise.catch(() => {
    // Stub 599 is not a valid RPC body; headers were already captured.
  });
}

describe("createShowzyClient (contract.md §3)", () => {
  it("sends bearer, selector, and /rpc path through the mocked transport", async () => {
    expect("sample" in sampleRouter).toBe(true);
    const requests: Request[] = [];
    const created = createShowzyClient<SampleRouter>({
      apiUrl: "http://api.test/",
      getAccessToken: () => "token-1",
      initialCompanyId: "company-a",
      fetch: (request) => {
        requests.push(request);
        return Promise.resolve(new Response(null, { status: 599 }));
      },
    });

    await ignoreRpcFailure(created.client.sample.ping({}));
    created.setActiveCompany(null);
    await ignoreRpcFailure(created.client.sample.ping({}));

    expect(requests).toHaveLength(2);
    expect(new URL(requests[0]?.url ?? "").origin).toBe("http://api.test");
    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/rpc/sample/ping");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer token-1");
    expect(requests[0]?.headers.get("x-company-id")).toBe("company-a");
    expect(requests[1]?.headers.has("x-company-id")).toBe(false);
  });

  it("omits authorization when the token provider returns null", async () => {
    const requests: Request[] = [];
    const created = createShowzyClient<SampleRouter>({
      apiUrl: "http://api.test",
      getAccessToken: () => null,
      fetch: (request) => {
        requests.push(request);
        return Promise.resolve(new Response(null, { status: 599 }));
      },
    });
    await ignoreRpcFailure(created.client.sample.ping({}));
    expect(requests[0]?.headers.has("authorization")).toBe(false);
  });

  it("reuses a mutation-attempt key", () => {
    const created = createShowzyClient({ apiUrl: "http://api.test" });
    const attempt = created.createMutationAttempt();
    expect(attempt.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(attempt.options.context.idempotencyKey).toBe(attempt.key);
    expect(attempt.withChallenge("c-1").context.confirmationChallengeId).toBe(
      "c-1",
    );
    expect(attempt.withChallenge("c-1").context.idempotencyKey).toBe(
      attempt.key,
    );
  });
});
