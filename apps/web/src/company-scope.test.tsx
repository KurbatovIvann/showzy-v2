/**
 * Company scope (SHO-313). `/rpc` is mocked with MSW — never module
 * internals. The slug is a display selector; membership is verified
 * server-side via `x-company-id` (ADR-0013, ADR-0030).
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { listMineQueryKey } from "./features/companies/api/list-mine";
import { contractQueryKey } from "./api/query-options";
import { DEVICE_PREF_LAST_COMPANY_SLUG_KEY } from "./prefs/storage";
import {
  BAKERY_COMPANY_ID,
  BAKERY_MEMBERSHIP,
  COMPANY_SELECTOR_HEADER,
  FLOWERS_COMPANY_ID,
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "./test/company-fixtures";
import { listMineState, PANEL_ORIGIN, server, sessionState } from "./test/msw";
import { renderApp } from "./test/render";

afterEach(cleanup);

function signInWith(memberships: typeof listMineState.memberships): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = memberships;
}

describe("company slug resolve (SHO-313)", () => {
  it("resolves a known slug, sets x-company-id before a later RPC, and remembers the slug", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    const { apiClient, router } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/kviti-lviv");
    expect(apiClient.getActiveCompany()).toBe(FLOWERS_COMPANY_ID);
    expect(listMineState.calls.length).toBeGreaterThan(0);
    expect(listMineState.calls[0]?.path).toBe("/rpc/companies/listMine");
    expect(listMineState.calls[0]?.companyId).toBeNull();

    await apiClient.client.companies.listMine({});
    const afterScope = listMineState.calls.at(-1);
    expect(afterScope?.companyId).toBe(FLOWERS_COMPANY_ID);
    expect(window.localStorage.getItem(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBe(
      "kviti-lviv",
    );
  });

  it("shows not-found for an unknown slug without setting the selector", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    const { apiClient, router } = await renderApp("/no-such-company");
    expect(
      await screen.findByRole("heading", { name: "Компанію не знайдено" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/no-such-company");
    expect(apiClient.getActiveCompany()).toBeNull();
    expect(screen.queryByRole("heading", { name: "Квіти Львів" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "До списку компаній" }),
    ).toBeDefined();
  });

  it("shows the picker when listMine is empty", async () => {
    signInWith([]);
    const { router } = await renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Оберіть компанію" }),
    ).toBeDefined();
    expect(screen.getByText("Немає компаній")).toBeDefined();
    expect(router.state.location.pathname).toBe("/");
  });

  it("sends an empty listMine at a slug URL to the picker", async () => {
    signInWith([]);
    const { router, apiClient } = await renderApp("/kviti-lviv");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(
      await screen.findByRole("heading", { name: "Оберіть компанію" }),
    ).toBeDefined();
    expect(apiClient.getActiveCompany()).toBeNull();
  });

  it("redirects / to the last visited slug when it is still a membership", async () => {
    signInWith([FLOWERS_MEMBERSHIP, BAKERY_MEMBERSHIP]);
    window.localStorage.setItem(DEVICE_PREF_LAST_COMPANY_SLUG_KEY, "pekarnya");
    const { router } = await renderApp("/");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pekarnya");
    });
    expect(
      await screen.findByRole("heading", { name: "Пекарня" }),
    ).toBeDefined();
  });

  it("keeps / on the picker when the stored slug is not a membership", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    window.localStorage.setItem(DEVICE_PREF_LAST_COMPANY_SLUG_KEY, "pekarnya");
    const { router } = await renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Оберіть компанію" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("link", { name: "Квіти Львів" })).toBeDefined();
  });
});

describe("company switch (SHO-313)", () => {
  it("navigates by slug and drops company-scoped query rows", async () => {
    signInWith([FLOWERS_MEMBERSHIP, BAKERY_MEMBERSHIP]);
    const { apiClient, queryClient, router } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();

    const tenantKey = contractQueryKey("companies.get", FLOWERS_COMPANY_ID, {});
    const accountKey = contractQueryKey("companies.listMine", null, {});
    queryClient.setQueryData(tenantKey, { id: FLOWERS_COMPANY_ID });
    expect(queryClient.getQueryData(accountKey)).toBeDefined();
    expect(queryClient.getQueryData(tenantKey)).toEqual({
      id: FLOWERS_COMPANY_ID,
    });

    fireEvent.click(screen.getByRole("link", { name: "Пекарня" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pekarnya");
    });
    expect(
      await screen.findByRole("heading", { name: "Пекарня" }),
    ).toBeDefined();
    expect(apiClient.getActiveCompany()).toBe(BAKERY_COMPANY_ID);
    expect(queryClient.getQueryData(tenantKey)).toBeUndefined();
    expect(queryClient.getQueryData(accountKey)).toBeDefined();
    expect(window.localStorage.getItem(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBe(
      "pekarnya",
    );
  });

  it("keeps tenant cache when listMine refetches the same company", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    const { apiClient, queryClient } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    const tenantKey = contractQueryKey("companies.get", FLOWERS_COMPANY_ID, {});
    queryClient.setQueryData(tenantKey, { id: FLOWERS_COMPANY_ID });
    await queryClient.invalidateQueries({ queryKey: listMineQueryKey() });
    await waitFor(() => {
      expect(queryClient.getQueryData(listMineQueryKey())).toBeDefined();
    });
    expect(queryClient.getQueryData(tenantKey)).toEqual({
      id: FLOWERS_COMPANY_ID,
    });
    expect(apiClient.getActiveCompany()).toBe(FLOWERS_COMPANY_ID);
  });
});

describe("company listMine errors (SHO-313)", () => {
  it("renders retry copy on a failed listMine without leaking the body", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/companies/listMine`, () => {
        return HttpResponse.json(
          { message: "otp=999999 leaked" },
          { status: 500 },
        );
      }),
    );
    await renderApp("/");
    expect(
      await screen.findByRole("heading", {
        name: "Не вдалося завантажити компанії",
      }),
    ).toBeDefined();
    expect(screen.queryByText(/999999/)).toBeNull();
    expect(screen.queryByText(/leaked/)).toBeNull();
  });
});

describe("company header (SHO-313)", () => {
  it("does not send x-company-id on the resolving listMine", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    const resolving = listMineState.calls.filter(
      (call) => call.path === "/rpc/companies/listMine",
    );
    expect(resolving[0]?.companyId).toBeNull();
    expect(COMPANY_SELECTOR_HEADER).toBe("x-company-id");
  });

  it("holds the outlet until the selector is set, then sends x-company-id on companies.get", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    let releaseListMine: (() => void) | undefined;
    const listMineGate = new Promise<void>((resolve) => {
      releaseListMine = resolve;
    });
    server.use(
      http.post(
        `${PANEL_ORIGIN}/rpc/companies/listMine`,
        async ({ request }) => {
          listMineState.calls.push({
            path: new URL(request.url).pathname,
            companyId: request.headers.get(COMPANY_SELECTOR_HEADER),
          });
          await listMineGate;
          return HttpResponse.json({
            json: { memberships: listMineState.memberships },
          });
        },
      ),
    );
    const { apiClient } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByText("Завантаження вашої компанії"),
    ).toBeDefined();
    expect(apiClient.getActiveCompany()).toBeNull();
    expect(screen.queryByRole("heading", { name: "Квіти Львів" })).toBeNull();
    expect(
      listMineState.calls.some((call) => call.path === "/rpc/companies/get"),
    ).toBe(false);
    expect(listMineState.calls.every((call) => call.companyId === null)).toBe(
      true,
    );

    releaseListMine?.();
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    expect(apiClient.getActiveCompany()).toBe(FLOWERS_COMPANY_ID);

    await apiClient.client.companies.get({});
    const scoped = listMineState.calls.find(
      (call) => call.path === "/rpc/companies/get",
    );
    expect(scoped?.companyId).toBe(FLOWERS_COMPANY_ID);
  });
});
