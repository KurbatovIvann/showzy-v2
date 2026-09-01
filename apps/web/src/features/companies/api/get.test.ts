import { describe, expect, it, vi } from "vitest";

import { createShowzyClient } from "../../../api/client";
import { createWebQueryClient } from "../../../api/query-client";
import { StaleCompanyQueryError } from "../../../api/query-options";
import {
  GET_COMPANY_ACTION,
  companyGetQueryKey,
  companyGetQueryOptions,
} from "./get";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("companies.get query key (SHO-330)", () => {
  it("is [actionName, companyId, input] and never omits company scope", () => {
    expect(GET_COMPANY_ACTION).toBe("companies.get");
    expect(companyGetQueryKey("company-a")).toEqual([
      "companies.get",
      "company-a",
      {},
    ]);
    expect(companyGetQueryKey("company-a")[1]).not.toBe("null-company");
  });
});

describe("companyGetQueryOptions live selector (SHO-330)", () => {
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
              id: COMPANY_A,
              name: "Bakery",
              slug: "bakery",
              prefix: "BK",
              legal: null,
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const queryClient = createWebQueryClient();
    const staleReactCompanyId = COMPANY_A;
    const options = companyGetQueryOptions({
      client,
      companyId: staleReactCompanyId,
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
