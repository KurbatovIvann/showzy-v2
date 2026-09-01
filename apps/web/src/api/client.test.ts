import { describe, expect, it } from "vitest";

import { createShowzyClient } from "./client";

async function ignoreRpcFailure(promise: Promise<unknown>): Promise<void> {
  await promise.catch(() => {
    // Stub 599 is not a valid RPC body; headers were already captured.
  });
}

describe("createShowzyClient (browser session cookies)", () => {
  it("sends same-origin /rpc with credentials include and no Cookie header", async () => {
    const requests: Request[] = [];
    const created = createShowzyClient({
      baseUrl: "http://panel.test",
      fetch: (request) => {
        requests.push(request);
        return Promise.resolve(new Response(null, { status: 599 }));
      },
    });

    await ignoreRpcFailure(created.client.companies.listMine({}));

    expect(requests).toHaveLength(1);
    const request = requests[0];
    if (request === undefined) {
      throw new Error("expected an rpc request");
    }
    expect(new URL(request.url).origin).toBe("http://panel.test");
    expect(new URL(request.url).pathname).toBe("/rpc/companies/listMine");
    expect(request.credentials).toBe("include");
    expect(request.headers.has("cookie")).toBe(false);
    expect(request.headers.has("authorization")).toBe(false);
  });

  it("defaults the RPC origin to the document origin so /rpc is an absolute URL", async () => {
    const requests: Request[] = [];
    const created = createShowzyClient({
      fetch: (request) => {
        requests.push(request);
        return Promise.resolve(new Response(null, { status: 599 }));
      },
    });
    await ignoreRpcFailure(created.client.companies.listMine({}));
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? "").origin).toBe(window.location.origin);
    expect(new URL(requests[0]?.url ?? "").pathname).toBe(
      "/rpc/companies/listMine",
    );
  });

  it("notifies every onActiveCompanyChange listener and honors unsubscribe", () => {
    const created = createShowzyClient({ baseUrl: "http://panel.test" });
    const seen: Array<string | null> = [];
    const unsubscribeFirst = created.onActiveCompanyChange((companyId) => {
      seen.push(companyId);
    });
    created.onActiveCompanyChange((companyId) => {
      seen.push(`second:${companyId ?? "null"}`);
    });
    created.setActiveCompany("company-a");
    unsubscribeFirst();
    created.setActiveCompany(null);
    expect(seen).toEqual(["company-a", "second:company-a", "second:null"]);
  });
});
