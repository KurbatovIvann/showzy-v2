import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildContractRouter } from "@showzy/contract";
import { defineActionContract } from "@showzy/core/contract";

import { createShowzyClient } from "./client";
import { createShowzyQueryClient } from "./query-client";
import {
  contractQueryKey,
  contractQueryOptions,
  NULL_COMPANY_QUERY_SCOPE,
} from "./query-options";

const ping = defineActionContract({
  name: "sample.ping",
  description: "Fixture read used only by the query-options wiring test.",
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
  input: z.object({ n: z.number() }),
  output: z.object({ ok: z.boolean() }),
});

const sampleRouter = buildContractRouter({ sample: { ping } });
type SampleRouter = typeof sampleRouter;

function samplePingQueryOptions(
  client: ReturnType<typeof createShowzyClient<SampleRouter>>,
  input: { n: number },
) {
  return contractQueryOptions({
    actionName: "sample.ping",
    companyId: client.getActiveCompany(),
    input,
    getActiveCompany: () => client.getActiveCompany(),
    queryFn: () => client.client.sample.ping(input),
  });
}

describe("contractQueryOptions", () => {
  it("puts action name, company selector, and input in the key", () => {
    expect("sample" in sampleRouter).toBe(true);
    const created = createShowzyClient<SampleRouter>({
      apiUrl: "http://api.test",
      initialCompanyId: "company-a",
    });
    const options = samplePingQueryOptions(created, { n: 1 });
    expect(options.queryKey).toEqual(
      contractQueryKey("sample.ping", "company-a", { n: 1 }),
    );
    created.setActiveCompany(null);
    expect(samplePingQueryOptions(created, { n: 1 }).queryKey[1]).toBe(
      NULL_COMPANY_QUERY_SCOPE,
    );
  });

  it("calls the contract procedure through queryFn", async () => {
    const requests: Request[] = [];
    const created = createShowzyClient<SampleRouter>({
      apiUrl: "http://api.test",
      initialCompanyId: "company-a",
      fetch: (request) => {
        requests.push(request);
        return Promise.resolve(new Response(null, { status: 599 }));
      },
    });
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    await queryClient
      .fetchQuery({
        ...samplePingQueryOptions(created, { n: 7 }),
        retry: false,
      })
      .catch(() => undefined);
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/rpc/sample/ping");
    expect(requests[0]?.headers.get("x-company-id")).toBe("company-a");
    queryClient.clear();
  });
});
