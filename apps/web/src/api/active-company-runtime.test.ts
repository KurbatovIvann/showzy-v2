import { describe, expect, it } from "vitest";

import { createCompanyPrefs } from "../prefs/company-prefs";
import { createMemoryPrefsStore } from "../prefs/storage";
import { bindActiveCompanyRuntime } from "./active-company-runtime";
import { createShowzyClient } from "./client";
import { createWebQueryClient } from "./query-client";
import { contractQueryKey } from "./query-options";

describe("bindActiveCompanyRuntime", () => {
  it("clears tenant queries and drops the stored slug when the selector is null", () => {
    const queryClient = createWebQueryClient({ retryQueries: false });
    const prefs = createCompanyPrefs(createMemoryPrefsStore());
    prefs.setLastCompanySlug("kviti-lviv");
    const created = createShowzyClient({
      baseUrl: "http://panel.test",
      initialCompanyId: "company-a",
    });
    const seen: Array<string | null> = [];
    const unbind = bindActiveCompanyRuntime({
      client: created,
      queryClient,
      prefs,
      onCompanyId: (companyId) => {
        seen.push(companyId);
      },
    });
    const tenantKey = contractQueryKey("companies.get", "company-a", {});
    queryClient.setQueryData(tenantKey, { id: "company-a" });
    created.setActiveCompany("company-b");
    expect(queryClient.getQueryData(tenantKey)).toBeUndefined();
    expect(prefs.getLastCompanySlug()).toBe("kviti-lviv");
    created.setActiveCompany(null);
    expect(prefs.getLastCompanySlug()).toBeNull();
    expect(seen).toEqual(["company-b", null]);
    unbind();
  });
});
