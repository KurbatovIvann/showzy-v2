import { isContractProcedure } from "@orpc/contract";
import { defineActionContract } from "@showzy/core/contract";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildContractRouter } from "./contract-router.js";
import { createContractClient, RPC_PREFIX } from "./create-client.js";
import { createMutationAttempt } from "./mutation-attempt.js";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from "./transport-meta.js";

const submit = defineActionContract({
  name: "sample.submit",
  description: "Idempotent staff write.",
  principal: "staff",
  transport: "client",
  aiExposure: "internal",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
  permissions: ["sample:manage"],
  input: z.object({ note: z.string() }),
  output: z.object({ receiptId: z.string() }),
});

const sampleRouter = buildContractRouter({ sample: { submit } });
type SampleRouter = typeof sampleRouter;

async function ignoreRpcFailure(promise: Promise<unknown>): Promise<void> {
  await promise.catch(() => {
    // Stub 599 is not a valid RPC body; headers were already captured.
  });
}

async function captureRequest(
  run: (
    created: ReturnType<typeof createContractClient<SampleRouter>>,
  ) => Promise<void>,
  options: {
    readonly getAccessToken?: () => string | null;
    readonly getCookie?: () => string | null;
    readonly initialCompanyId?: string | null;
  } = {},
): Promise<Request[]> {
  const requests: Request[] = [];
  const created = createContractClient<SampleRouter>({
    baseUrl: "http://contract.test",
    ...options,
    fetch: (request) => {
      requests.push(request);
      return Promise.resolve(new Response(null, { status: 599 }));
    },
  });
  await run(created);
  return requests;
}

describe("createContractClient (contract.md §3)", () => {
  it("types the client from a defined contract router", () => {
    expect(isContractProcedure(sampleRouter.sample.submit)).toBe(true);
  });
  it("mounts at /rpc under the API origin", async () => {
    const [request] = await captureRequest(async ({ client }) => {
      await ignoreRpcFailure(client.sample.submit({ note: "hello" }));
    });
    expect(request).toBeDefined();
    expect(new URL(request?.url ?? "").pathname).toBe(
      `${RPC_PREFIX}/sample/submit`,
    );
  });

  it("sends the bearer token and the active-company selector", async () => {
    const requests = await captureRequest(
      async (created) => {
        created.setActiveCompany("company-a");
        await ignoreRpcFailure(created.client.sample.submit({ note: "hello" }));
        created.setActiveCompany("company-b");
        await ignoreRpcFailure(created.client.sample.submit({ note: "hello" }));
        created.setActiveCompany(null);
        await ignoreRpcFailure(created.client.sample.submit({ note: "hello" }));
      },
      { getAccessToken: () => "token-1" },
    );
    expect(requests).toHaveLength(3);
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer token-1");
    expect(requests[0]?.headers.get(COMPANY_SELECTOR_HEADER)).toBe("company-a");
    expect(requests[1]?.headers.get(COMPANY_SELECTOR_HEADER)).toBe("company-b");
    expect(requests[2]?.headers.has(COMPANY_SELECTOR_HEADER)).toBe(false);
  });

  it("sends the session cookie with credentials omitted", async () => {
    const requests = await captureRequest(
      async ({ client }) => {
        await ignoreRpcFailure(client.sample.submit({ note: "hello" }));
      },
      { getCookie: () => "better-auth.session_token=abc" },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get("cookie")).toBe(
      "better-auth.session_token=abc",
    );
    expect(requests[0]?.headers.has("authorization")).toBe(false);
    expect(requests[0]?.credentials).toBe("omit");
  });

  it("omits authorization and the selector when anonymous", async () => {
    const [request] = await captureRequest(async ({ client }) => {
      await ignoreRpcFailure(client.sample.submit({ note: "hello" }));
    });
    expect(request?.headers.has("authorization")).toBe(false);
    expect(request?.headers.has(COMPANY_SELECTOR_HEADER)).toBe(false);
  });

  it("reuses the mutation-attempt key on every retry of that submit", async () => {
    const keys: Array<string | null> = [];
    const { client, createMutationAttempt: startAttempt } =
      createContractClient<SampleRouter>({
        baseUrl: "http://contract.test",
        fetch: (request) => {
          keys.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));
          return Promise.resolve(new Response(null, { status: 599 }));
        },
      });
    const attempt = startAttempt();

    await ignoreRpcFailure(
      client.sample.submit({ note: "retry me" }, attempt.options),
    );
    await ignoreRpcFailure(
      client.sample.submit({ note: "retry me" }, attempt.options),
    );

    expect(keys).toEqual([attempt.key, attempt.key]);
    expect(createMutationAttempt().key).not.toBe(attempt.key);
  });

  it("does not send an idempotency key unless an attempt is supplied", async () => {
    const [request] = await captureRequest(async ({ client }) => {
      await ignoreRpcFailure(client.sample.submit({ note: "no key" }));
    });
    expect(request?.headers.has(IDEMPOTENCY_KEY_HEADER)).toBe(false);
  });

  it("sends confirmation challenge meta without replacing the attempt key", async () => {
    const requests: Request[] = [];
    const { client, createMutationAttempt: startAttempt } =
      createContractClient<SampleRouter>({
        baseUrl: "http://contract.test",
        fetch: (request) => {
          requests.push(request);
          return Promise.resolve(new Response(null, { status: 599 }));
        },
      });
    const attempt = startAttempt();
    await ignoreRpcFailure(
      client.sample.submit(
        { note: "confirm" },
        attempt.withChallenge("challenge-9"),
      ),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get(IDEMPOTENCY_KEY_HEADER)).toBe(attempt.key);
    expect(requests[0]?.headers.get(CONFIRMATION_CHALLENGE_HEADER)).toBe(
      "challenge-9",
    );
  });

  it("honours initialCompanyId until the setter replaces it", async () => {
    const [request] = await captureRequest(
      async ({ client }) => {
        await ignoreRpcFailure(client.sample.submit({ note: "hello" }));
      },
      { initialCompanyId: "company-initial" },
    );
    expect(request?.headers.get(COMPANY_SELECTOR_HEADER)).toBe(
      "company-initial",
    );
  });
});
