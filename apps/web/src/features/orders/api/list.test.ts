import { describe, expect, it, vi } from "vitest";

import { createShowzyClient } from "../../../api/client";
import { createWebQueryClient } from "../../../api/query-client";
import { StaleCompanyQueryError } from "../../../api/query-options";
import {
  LIST_ORDERS_ACTION,
  ordersListQueryKey,
  ordersListQueryOptions,
} from "./list";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PAGE_INPUT = { kind: "page.summary" } as const;

describe("orders.list query key (SHO-377)", () => {
  it("is [actionName, companyId, input] and never omits company scope", () => {
    expect(LIST_ORDERS_ACTION).toBe("orders.list");
    expect(ordersListQueryKey("company-a", PAGE_INPUT)).toEqual([
      "orders.list",
      "company-a",
      PAGE_INPUT,
    ]);
    expect(ordersListQueryKey("company-a", PAGE_INPUT)[1]).not.toBe(
      "null-company",
    );
  });
});

describe("ordersListQueryOptions live selector (SHO-377)", () => {
  it("does not write when live setActiveCompany drifts mid-flight", async () => {
    let release: (() => void) | undefined;
    let fetchStarted = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = createShowzyClient({
      baseUrl: "http://panel.test",
      initialCompanyId: COMPANY_A,
      fetch: async () => {
        fetchStarted = true;
        await gate;
        return new Response(
          JSON.stringify({
            json: {
              kind: "page.summary",
              items: [],
              nextCursor: null,
              customerMatchTruncated: false,
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const queryClient = createWebQueryClient();
    const staleReactCompanyId = COMPANY_A;
    const options = ordersListQueryOptions({
      client,
      companyId: staleReactCompanyId,
      input: PAGE_INPUT,
    });
    const pending = queryClient.fetchQuery(options);
    await vi.waitFor(() => {
      expect(fetchStarted).toBe(true);
    });
    client.setActiveCompany(COMPANY_B);
    release?.();
    await expect(pending).rejects.toBeInstanceOf(StaleCompanyQueryError);
    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
    queryClient.clear();
  });
});
