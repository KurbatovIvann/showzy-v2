/**
 * Directory route tree (SHO-327). `/rpc` is mocked with MSW — never
 * module internals. Asserts public URLs, nested outlets, pathless
 * `_panel` / `_full` layouts, unknown routes, and deep-link reloads.
 */
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FLOWERS_MEMBERSHIP, signedInOwner } from "../company-fixtures";
import { listMineState, sessionState } from "../msw";
import { renderApp } from "../render";

afterEach(cleanup);

function signInWithFlowers(): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = [FLOWERS_MEMBERSHIP];
}

function routeIds(
  router: Awaited<ReturnType<typeof renderApp>>["router"],
): readonly string[] {
  return router.state.matches.map((match) => match.routeId);
}

async function waitForSection(region: string): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector(".panel-shell")).not.toBeNull();
  });
  expect(await screen.findByRole("region", { name: region })).toBeDefined();
}

const SECTION_URLS: ReadonlyArray<{
  readonly path: string;
  readonly region: string;
}> = [
  { path: "/kviti-lviv/orders", region: "Замовлення" },
  { path: "/kviti-lviv/orders/ord-1", region: "Замовлення" },
  { path: "/kviti-lviv/orders/new", region: "Замовлення" },
  { path: "/kviti-lviv/documents", region: "Документи" },
  { path: "/kviti-lviv/documents/doc-1", region: "Документи" },
  { path: "/kviti-lviv/documents/new", region: "Документи" },
  { path: "/kviti-lviv/documents/templates", region: "Документи" },
  { path: "/kviti-lviv/documents/templates/tmpl-1", region: "Документи" },
  { path: "/kviti-lviv/products", region: "Товари" },
  { path: "/kviti-lviv/products/new", region: "Товари" },
  { path: "/kviti-lviv/products/prod-1", region: "Товари" },
  { path: "/kviti-lviv/products/prod-1/edit", region: "Товари" },
  { path: "/kviti-lviv/customers", region: "Клієнти" },
  { path: "/kviti-lviv/customers/new", region: "Клієнти" },
  { path: "/kviti-lviv/customers/c-1", region: "Клієнти" },
  { path: "/kviti-lviv/customers/groups", region: "Групи клієнтів" },
  { path: "/kviti-lviv/customers/groups/g-1", region: "Групи клієнтів" },
  { path: "/kviti-lviv/customers/groups/new", region: "Групи клієнтів" },
  {
    path: "/kviti-lviv/customers/counterparties",
    region: "Контрагенти",
  },
  {
    path: "/kviti-lviv/customers/counterparties/cp-1",
    region: "Контрагенти",
  },
  {
    path: "/kviti-lviv/customers/counterparties/new",
    region: "Контрагенти",
  },
  { path: "/kviti-lviv/invites", region: "Запрошення" },
  { path: "/kviti-lviv/invites/inv-1", region: "Запрошення" },
  { path: "/kviti-lviv/invites/new", region: "Запрошення" },
  { path: "/kviti-lviv/pricing", region: "Прайс-листи" },
  { path: "/kviti-lviv/pricing/pl-1", region: "Прайс-листи" },
  { path: "/kviti-lviv/pricing/new", region: "Прайс-листи" },
  { path: "/kviti-lviv/pricing/pl-1/edit", region: "Прайс-листи" },
  { path: "/kviti-lviv/company", region: "Компанія" },
  { path: "/kviti-lviv/company/legal", region: "Компанія" },
  { path: "/kviti-lviv/company/team", region: "Компанія" },
];

describe("directory route tree (SHO-327)", () => {
  it("resolves the products index through the pathless panel layout without a URL segment", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/products");
    await waitForSection("Товари");
    expect(router.state.location.pathname).toBe("/kviti-lviv/products");
    expect(router.state.location.pathname).not.toContain("_panel");
    expect(routeIds(router).some((id) => id.includes("/_panel"))).toBe(true);
    expect(routeIds(router).some((id) => id.includes("/_full"))).toBe(false);
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
  });

  it("keeps the products list parent mounted on a detail leaf", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/products/prod-1");
    await waitForSection("Товари");
    expect(router.state.location.pathname).toBe("/kviti-lviv/products/prod-1");
    expect(
      routeIds(router).some((id) =>
        id.endsWith("/_panel/products/$productId/"),
      ),
    ).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
  });

  it("resolves nested product edit through an Outlet-owning $productId parent, still inside panel chrome", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/products/prod-1/edit");
    await waitForSection("Товари");
    expect(router.state.location.pathname).toBe(
      "/kviti-lviv/products/prod-1/edit",
    );
    expect(document.querySelector(".panel-shell")).not.toBeNull();
    expect(
      routeIds(router).some((id) =>
        id.endsWith("/_panel/products/$productId/edit"),
      ),
    ).toBe(true);
    expect(routeIds(router).some((id) => id.includes("/_full"))).toBe(false);
  });

  it("keeps the template editor on the public URL via pathless _full, without panel chrome", async () => {
    signInWithFlowers();
    const { router } = await renderApp(
      "/kviti-lviv/documents/templates/tmpl-1/edit",
    );
    expect(
      await screen.findByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe(
      "/kviti-lviv/documents/templates/tmpl-1/edit",
    );
    expect(router.state.location.pathname).not.toContain("_full");
    expect(routeIds(router).some((id) => id.includes("/_full"))).toBe(true);
    expect(routeIds(router).some((id) => id.includes("/_panel"))).toBe(false);
    expect(document.querySelector(".panel-shell")).toBeNull();
    expect(screen.queryByRole("region", { name: "Документи" })).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
  });

  it("does not rewrite an unknown company-scoped path onto a known section", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/not-a-real-section");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/not-a-real-section",
      );
    });
    expect(router.state.location.pathname).not.toBe("/kviti-lviv/products");
    expect(router.state.location.pathname).not.toBe("/kviti-lviv/orders");
    expect(screen.queryByRole("region", { name: "Товари" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Замовлення" })).toBeNull();
    expect(routeIds(router).some((id) => id.includes("/_panel/products"))).toBe(
      false,
    );
  });

  it("renders unknown-company copy without panel chrome", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/no-such-company");
    expect(
      await screen.findByRole("heading", { name: "Компанію не знайдено" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/no-such-company");
    expect(document.querySelector(".panel-shell")).toBeNull();
    expect(screen.queryByRole("region", { name: "Замовлення" })).toBeNull();
  });

  it("renders the same nested edit screen on a deep-link reload as after client-side navigation", async () => {
    signInWithFlowers();
    const deep = await renderApp("/kviti-lviv/products/prod-1/edit");
    await waitForSection("Товари");
    expect(deep.router.state.location.pathname).toBe(
      "/kviti-lviv/products/prod-1/edit",
    );
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    const deepIds = routeIds(deep.router);

    cleanup();
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/products");
    await waitForSection("Товари");
    await act(async () => {
      await router.navigate({
        to: "/$companySlug/products/$productId/edit",
        params: { companySlug: "kviti-lviv", productId: "prod-1" },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/products/prod-1/edit",
      );
    });
    expect(await screen.findByRole("region", { name: "Товари" })).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    expect(document.querySelector(".panel-shell")).not.toBeNull();
    expect(routeIds(router)).toEqual(deepIds);
  });

  // One `it` per URL so each remount gets a fresh 15s timeout (SHO-332).
  it.each(SECTION_URLS)("covers $path ($region)", async ({ path, region }) => {
    signInWithFlowers();
    const { router } = await renderApp(path);
    await waitForSection(region);
    expect(router.state.location.pathname).toBe(path);
    expect(routeIds(router).some((id) => id.includes("/_panel"))).toBe(true);
  });

  it("keeps onboarding outside company scope", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [];
    const { router } = await renderApp("/onboarding");
    expect(
      await screen.findByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/onboarding");
    expect(routeIds(router).some((id) => id.includes("$companySlug"))).toBe(
      false,
    );
    expect(document.querySelector(".panel-shell")).toBeNull();
  });
});
