import { describe, expect, it, vi } from "vitest";

import { createShowzyClient } from "../../../api/client";
import { createWebQueryClient } from "../../../api/query-client";
import { StaleCompanyQueryError } from "../../../api/query-options";
import {
  LIST_CUSTOMERS_ACTION,
  ORDER_CUSTOMER_LOOKUP_INPUT,
  customersListQueryKey,
  customersListQueryOptions,
} from "./customers-list";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("customers.listCustomers query key (SHO-379)", () => {
  it("is [actionName, companyId, input] and never omits company scope", () => {
    expect(LIST_CUSTOMERS_ACTION).toBe("customers.listCustomers");
    expect(customersListQueryKey("company-a")).toEqual([
      "customers.listCustomers",
      "company-a",
      ORDER_CUSTOMER_LOOKUP_INPUT,
    ]);
    expect(customersListQueryKey("company-a")[1]).not.toBe("null-company");
  });

  it("puts search on the input in the key and omits blank search", () => {
    expect(customersListQueryKey("company-a", "  Зоя  ")).toEqual([
      "customers.listCustomers",
      "company-a",
      { ...ORDER_CUSTOMER_LOOKUP_INPUT, search: "Зоя" },
    ]);
    expect(customersListQueryKey("company-a", "   ")).toEqual(
      customersListQueryKey("company-a"),
    );
    expect(customersListQueryKey("company-a", "Зоя")).not.toEqual(
      customersListQueryKey("company-a"),
    );
  });
});

describe("customersListQueryOptions live selector (SHO-379)", () => {
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
            json: { items: [], nextCursor: null },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const queryClient = createWebQueryClient();
    const options = customersListQueryOptions({
      client,
      companyId: COMPANY_A,
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
