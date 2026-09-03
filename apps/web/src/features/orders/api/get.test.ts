import { describe, expect, it, vi } from "vitest";

import { createShowzyClient } from "../../../api/client";
import { createWebQueryClient } from "../../../api/query-client";
import { StaleCompanyQueryError } from "../../../api/query-options";
import {
  GET_ORDER_ACTION,
  ordersGetQueryKey,
  ordersGetQueryOptions,
  parseOrderId,
} from "./get";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("orders.get query key (SHO-378)", () => {
  it("is [actionName, companyId, input] and never omits company scope", () => {
    expect(GET_ORDER_ACTION).toBe("orders.get");
    expect(ordersGetQueryKey("company-a", ORDER_ID)).toEqual([
      "orders.get",
      "company-a",
      { orderId: ORDER_ID },
    ]);
    expect(ordersGetQueryKey("company-a", ORDER_ID)[1]).not.toBe(
      "null-company",
    );
  });

  it("refuses a non-uuid order id before the RPC", () => {
    expect(parseOrderId("ord-1")).toBeNull();
    expect(parseOrderId(ORDER_ID)).toBe(ORDER_ID);
    expect(
      ordersGetQueryOptions({
        client: createShowzyClient({ baseUrl: "http://panel.test" }),
        companyId: COMPANY_A,
        orderId: "ord-1",
      }).enabled,
    ).toBe(false);
  });
});

describe("ordersGetQueryOptions live selector (SHO-378)", () => {
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
              orderId: ORDER_ID,
              orderNumber: "KL-K7K3K4",
              customerId: null,
              status: "new",
              comment: null,
              totalNetMinor: "150000",
              totalTaxMinor: "0",
              totalGrossMinor: "150000",
              currency: "UAH",
              confirmedAt: null,
              createdAt: "2026-03-15T12:00:00.000Z",
              items: [],
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const queryClient = createWebQueryClient();
    const options = ordersGetQueryOptions({
      client,
      companyId: COMPANY_A,
      orderId: ORDER_ID,
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
