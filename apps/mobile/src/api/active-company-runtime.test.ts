import { describe, expect, it } from "vitest";

import { createDevicePrefs } from "../prefs/device-prefs";
import { createMemoryPrefsStore } from "../prefs/storage";
import { bindActiveCompanyRuntime } from "./active-company-runtime";
import { createShowzyClient } from "./client";
import { createShowzyQueryClient } from "./query-client";
import { contractQueryKey } from "./query-options";

describe("bindActiveCompanyRuntime", () => {
  it("fires persistence and cache isolation from one listener composition", () => {
    const prefs = createDevicePrefs(createMemoryPrefsStore());
    const created = createShowzyClient({
      apiUrl: "http://api.test",
      initialCompanyId: "company-a",
    });
    const queryClient = createShowzyQueryClient();
    const seen: Array<string | null> = [];
    const unbind = bindActiveCompanyRuntime({
      client: created,
      prefs,
      queryClient,
      onCompanyId: (companyId) => {
        seen.push(companyId);
      },
    });

    const companyAKey = contractQueryKey("sample.getOrder", "company-a", {
      orderId: "o-1",
    });
    queryClient.setQueryData(companyAKey, { orderId: "o-1" });

    created.setActiveCompany("company-b");
    expect(prefs.getLastCompanyId()).toBe("company-b");
    expect(queryClient.getQueryData(companyAKey)).toBeUndefined();
    expect(seen).toEqual(["company-b"]);

    unbind();
    created.setActiveCompany("company-c");
    expect(prefs.getLastCompanyId()).toBe("company-b");
    expect(seen).toEqual(["company-b"]);
    queryClient.clear();
  });
});
