import { describe, expect, it, vi } from "vitest";

import {
  accountContractQueryKey,
  accountContractQueryOptions,
  assertCompanyStillActive,
  contractQueryKey,
  contractQueryOptions,
  NULL_COMPANY_QUERY_SCOPE,
  StaleCompanyQueryError,
} from "./query-options";
import { createWebQueryClient } from "./query-client";

describe("contractQueryOptions", () => {
  it("puts action name, company selector, and input in the key", () => {
    expect(contractQueryKey("companies.listMine", null, {})).toEqual([
      "companies.listMine",
      NULL_COMPANY_QUERY_SCOPE,
      {},
    ]);
    expect(contractQueryKey("companies.get", "company-a", {})[1]).toBe(
      "company-a",
    );
  });

  it("runs queryFn only while the live selector still matches the key", async () => {
    const queryFn = vi.fn(() => Promise.resolve({ ok: true }));
    const queryClient = createWebQueryClient({ retryQueries: false });
    const options = contractQueryOptions({
      actionName: "sample.ping",
      companyId: "company-a",
      input: { n: 1 },
      getActiveCompany: () => "company-a",
      queryFn,
    });
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      ok: true,
    });
    expect(queryFn).toHaveBeenCalledOnce();
    queryClient.clear();
  });

  it("does not write another company's payload when the selector drifted mid-flight", async () => {
    let active: string | null = "company-a";
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queryFn = vi.fn(async () => {
      await gate;
      return { id: "company-a", secret: "tenant-a" };
    });
    const queryClient = createWebQueryClient({ retryQueries: false });
    const options = contractQueryOptions({
      actionName: "companies.get",
      companyId: "company-a",
      input: {},
      getActiveCompany: () => active,
      queryFn,
    });
    const pending = queryClient.fetchQuery(options);
    active = "company-b";
    release?.();
    await expect(pending).rejects.toBeInstanceOf(StaleCompanyQueryError);
    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
    queryClient.clear();
  });
});

describe("accountContractQueryOptions", () => {
  it("isolates null-company cache entries by authenticated session", () => {
    const input = {};
    expect(
      accountContractQueryKey("companies.listMine", "user-a", input),
    ).toEqual([
      "companies.listMine",
      NULL_COMPANY_QUERY_SCOPE,
      "user-a",
      input,
    ]);
  });

  it("runs independently of an active staff selector", async () => {
    const queryFn = vi.fn(() => Promise.resolve({ memberships: [] }));
    const queryClient = createWebQueryClient({ retryQueries: false });
    const options = accountContractQueryOptions({
      actionName: "companies.listMine",
      sessionUserId: "user-a",
      input: {},
      queryFn,
    });
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      memberships: [],
    });
    expect(queryFn).toHaveBeenCalledOnce();
    queryClient.clear();
  });
});

describe("assertCompanyStillActive", () => {
  it("throws StaleCompanyQueryError when the live selector drifted", () => {
    expect(() => {
      assertCompanyStillActive(() => "company-b", "company-a");
    }).toThrow(StaleCompanyQueryError);
    expect(() => {
      assertCompanyStillActive(() => "company-a", "company-a");
    }).not.toThrow();
  });
});
