import { ORPCError } from "@orpc/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { buildContractRouter } from "@showzy/contract";
import { defineActionContract } from "@showzy/core/contract";
import { MutationObserver } from "@tanstack/react-query";

import { createShowzyClient } from "./client";
import {
  bindActiveCompanyQueryIsolation,
  clearCachedContractQueries,
  createShowzyQueryClient,
  handleUnauthenticatedQueryError,
  QUERY_RETRY_LIMIT,
  queryRetryDelay,
} from "./query-client";
import {
  contractQueryKey,
  contractQueryOptions,
  NULL_COMPANY_QUERY_SCOPE,
} from "./query-options";

const getOrder = defineActionContract({
  name: "sample.getOrder",
  description: "Fixture read used only by the query runtime tests.",
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
  input: z.object({ orderId: z.string() }),
  output: z.object({ orderId: z.string(), totalMinor: z.string() }),
});

const sampleRouter = buildContractRouter({ sample: { getOrder } });
type SampleRouter = typeof sampleRouter;

function sampleGetOrderQueryOptions(
  client: ReturnType<typeof createShowzyClient<SampleRouter>>,
  input: { orderId: string },
) {
  return contractQueryOptions({
    actionName: "sample.getOrder",
    companyId: client.getActiveCompany(),
    input,
    queryFn: () => client.client.sample.getOrder(input),
  });
}

function permissionDenied(): ORPCError<string, unknown> {
  return new ORPCError("PERMISSION_DENIED", {
    defined: true,
    status: 403,
    message: "Not allowed.",
  });
}

function notFound(): ORPCError<string, unknown> {
  return new ORPCError("NOT_FOUND", {
    defined: true,
    status: 404,
    message: "Missing.",
  });
}

function validation(): ORPCError<string, { issues: [] }> {
  return new ORPCError("VALIDATION", {
    defined: true,
    status: 400,
    message: "Invalid.",
    data: { issues: [] },
  });
}

function unauthenticated(): ORPCError<string, unknown> {
  return new ORPCError("UNAUTHENTICATED", {
    defined: true,
    status: 401,
    message: "Sign in.",
  });
}

function confirmationRequired(): ORPCError<
  string,
  {
    challenge: {
      challengeId: string;
      summary: string;
      expiresAt: string;
    };
  }
> {
  return new ORPCError("CONFIRMATION_REQUIRED", {
    defined: true,
    status: 409,
    message: "Confirm.",
    data: {
      challenge: {
        challengeId: "c-1",
        summary: "Delete?",
        expiresAt: "2026-08-21T00:00:00.000Z",
      },
    },
  });
}

function timeout(): ORPCError<string, unknown> {
  return new ORPCError("TIMEOUT", {
    defined: true,
    status: 504,
    message: "Timed out.",
  });
}

function rateLimited(
  retryAfterSec: number,
): ORPCError<string, { retryAfterSec: number }> {
  return new ORPCError("RATE_LIMITED", {
    defined: true,
    status: 429,
    message: "Slow down.",
    data: { retryAfterSec },
  });
}

async function countQueryAttempts(error: Error): Promise<number> {
  const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
  let calls = 0;
  await queryClient
    .fetchQuery({
      queryKey: ["retry-probe"],
      queryFn: () => {
        calls += 1;
        return Promise.reject(error);
      },
    })
    .catch(() => undefined);
  queryClient.clear();
  return calls;
}

describe("createShowzyQueryClient retry policy", () => {
  it("retries network and TIMEOUT failures", async () => {
    expect("sample" in sampleRouter).toBe(true);
    expect(await countQueryAttempts(new TypeError("Failed to fetch"))).toBe(
      QUERY_RETRY_LIMIT + 1,
    );
    expect(await countQueryAttempts(timeout())).toBe(QUERY_RETRY_LIMIT + 1);
  });

  it("retries RATE_LIMITED and honors retryAfterSec in the delay", async () => {
    expect(await countQueryAttempts(rateLimited(12))).toBe(
      QUERY_RETRY_LIMIT + 1,
    );
    expect(queryRetryDelay(0, rateLimited(12))).toBe(12_000);
  });

  it("does not retry client wire codes", async () => {
    expect(await countQueryAttempts(permissionDenied())).toBe(1);
    expect(await countQueryAttempts(notFound())).toBe(1);
    expect(await countQueryAttempts(validation())).toBe(1);
    expect(await countQueryAttempts(unauthenticated())).toBe(1);
    expect(await countQueryAttempts(confirmationRequired())).toBe(1);
  });

  it("does not retry mutations", async () => {
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    let calls = 0;
    const observer = new MutationObserver(queryClient, {
      mutationFn: () => {
        calls += 1;
        return Promise.reject(timeout());
      },
    });
    await observer.mutate().catch(() => undefined);
    expect(calls).toBe(1);
    queryClient.clear();
  });
});

describe("query cache isolation", () => {
  it("clears leftover company rows on setActiveCompany", () => {
    const queryClient = createShowzyQueryClient();
    const created = createShowzyClient<SampleRouter>({
      apiUrl: "http://api.test",
    });
    bindActiveCompanyQueryIsolation(created, queryClient);

    const companyAKey = contractQueryKey("sample.getOrder", "company-a", {
      orderId: "o-1",
    });
    queryClient.setQueryData(companyAKey, {
      orderId: "o-1",
      totalMinor: "1990",
    });
    expect(queryClient.getQueryData(companyAKey)).toEqual({
      orderId: "o-1",
      totalMinor: "1990",
    });

    created.setActiveCompany("company-b");
    expect(queryClient.getQueryData(companyAKey)).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("clears leftover rows on sign-out", () => {
    const queryClient = createShowzyQueryClient();
    const priceKey = contractQueryKey("sample.getOrder", "company-a", {
      orderId: "o-2",
    });
    queryClient.setQueryData(priceKey, { orderId: "o-2", totalMinor: "500" });
    clearCachedContractQueries(queryClient);
    expect(queryClient.getQueryData(priceKey)).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("uses a distinct null-company key namespace", () => {
    expect(
      contractQueryKey("sample.getOrder", null, { orderId: "o-1" })[1],
    ).toBe(NULL_COMPANY_QUERY_SCOPE);
    expect(
      contractQueryKey("sample.getOrder", "company-a", { orderId: "o-1" })[1],
    ).toBe("company-a");
  });
});

describe("UNAUTHENTICATED query handling", () => {
  it("notifies the session hook on query 401", async () => {
    const onUnauthenticated = vi.fn();
    const queryClient = createShowzyQueryClient({
      onUnauthenticated,
      retryDelay: () => 0,
    });
    await queryClient
      .fetchQuery({
        queryKey: ["unauthenticated"],
        queryFn: () => Promise.reject(unauthenticated()),
      })
      .catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it("does not 401-gate anonymous public/share work", () => {
    const clearSession = vi.fn();
    const clearCache = vi.fn();
    handleUnauthenticatedQueryError({
      hadSession: false,
      clearSession,
      clearCache,
    });
    expect(clearSession).not.toHaveBeenCalled();
    expect(clearCache).not.toHaveBeenCalled();

    handleUnauthenticatedQueryError({
      hadSession: true,
      clearSession,
      clearCache,
    });
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it("issues a read without a session (no client-side 401 gate)", async () => {
    const requests: Request[] = [];
    const created = createShowzyClient<SampleRouter>({
      apiUrl: "http://api.test",
      getAccessToken: () => null,
      fetch: (request) => {
        requests.push(request);
        return Promise.resolve(new Response(null, { status: 599 }));
      },
    });
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    await queryClient
      .fetchQuery({
        ...sampleGetOrderQueryOptions(created, { orderId: "o-public" }),
        retry: false,
      })
      .catch(() => undefined);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.has("authorization")).toBe(false);
    queryClient.clear();
  });
});
