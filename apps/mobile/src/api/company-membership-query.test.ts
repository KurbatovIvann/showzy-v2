import { describe, expect, it } from "vitest";

import { createShowzyClient } from "./client";
import {
  LIST_MINE_ACTION,
  listMineQueryKey,
  listMineQueryOptions,
} from "./company-membership-query";
import { ClientUnavailableError } from "./errors";
import { createShowzyQueryClient } from "./query-client";
import { NULL_COMPANY_QUERY_SCOPE } from "./query-options";

describe("listMineQueryOptions", () => {
  it("uses the missing-session sentinel and stays disabled without a session", () => {
    const options = listMineQueryOptions(null, null);
    expect(options.queryKey).toEqual(
      listMineQueryKey("missing-session"),
    );
    expect(options.queryKey[1]).toBe(NULL_COMPANY_QUERY_SCOPE);
    expect(options.enabled).toBe(false);
    expect(LIST_MINE_ACTION).toBe("companies.listMine");
  });

  it("enables only when both the client and session user id are present", () => {
    const created = createShowzyClient({ apiUrl: "http://api.test" });
    expect(listMineQueryOptions(created, null).enabled).toBe(false);
    expect(listMineQueryOptions(null, "user-a").enabled).toBe(false);
    expect(listMineQueryOptions(created, "user-a").enabled).toBe(true);
  });

  it("rejects with ClientUnavailableError when the client is missing", async () => {
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    await expect(
      queryClient.fetchQuery({
        ...listMineQueryOptions(null, "user-a"),
        retry: false,
      }),
    ).rejects.toBeInstanceOf(ClientUnavailableError);
    queryClient.clear();
  });
});
