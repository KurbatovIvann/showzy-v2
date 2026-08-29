import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  LIST_INVITES_ACTION,
  listInvitesInfiniteOptions,
} from "./invite.queries";

describe("listInvitesInfiniteOptions", () => {
  it("keys [actionName, companyId, input] and keeps cursor out of the key", () => {
    const unfiltered = listInvitesInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: {},
      getActiveCompany: () => "company-a",
    });
    const limited = listInvitesInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { limit: 50 },
      getActiveCompany: () => "company-a",
    });
    expect(unfiltered.queryKey).toEqual(
      contractQueryKey(LIST_INVITES_ACTION, "company-a", {}),
    );
    expect(limited.queryKey).toEqual(
      contractQueryKey(LIST_INVITES_ACTION, "company-a", { limit: 50 }),
    );
    expect(unfiltered.queryKey).not.toEqual(limited.queryKey);
    expect(JSON.stringify(unfiltered.queryKey)).not.toContain("cursor");
    expect(unfiltered.enabled).toBe(false);
  });
});
