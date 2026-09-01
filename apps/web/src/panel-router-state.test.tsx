/**
 * Router-derived panel state (SHO-328). `/rpc` is mocked with MSW.
 * Asserts active nav/tabs, phone list XOR detail, browser back, and
 * full-shell isolation from typed matches — not pathname prefixes.
 */
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolvePanelStateFromMatches } from "./features/panel/panel-route-state";
import { FLOWERS_MEMBERSHIP, signedInOwner } from "./test/company-fixtures";
import { listMineState, sessionState } from "./test/msw";
import { renderApp } from "./test/render";

afterEach(cleanup);

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {
    this.callback([], this);
  }

  unobserve(): void {}

  disconnect(): void {
    FakeResizeObserver.instances = FakeResizeObserver.instances.filter(
      (item) => item !== this,
    );
  }

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

const nativeResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = nativeResizeObserver;
  FakeResizeObserver.instances = [];
});

function signInWithFlowers(): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = [FLOWERS_MEMBERSHIP];
}

function setShellWidth(width: number): void {
  const shell = document.querySelector(".panel-shell");
  expect(shell).not.toBeNull();
  Object.defineProperty(shell, "clientWidth", {
    configurable: true,
    value: width,
  });
  act(() => {
    for (const observer of FakeResizeObserver.instances) {
      observer.callback([], observer);
    }
  });
}

async function waitForRegion(region: string): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector(".panel-shell")).not.toBeNull();
  });
  expect(await screen.findByRole("region", { name: region })).toBeDefined();
}

describe("route-match panel state (SHO-328)", () => {
  it("resolves section, pane, and listTo from matched staticData", async () => {
    signInWithFlowers();
    const cases: ReadonlyArray<{
      readonly path: string;
      readonly region?: string;
      readonly panelSection: string | undefined;
      readonly pane: string | undefined;
      readonly listTo: string | undefined;
    }> = [
      {
        path: "/kviti-lviv",
        region: "Замовлення",
        panelSection: "orders",
        pane: "list",
        listTo: "/$companySlug/orders",
      },
      {
        path: "/kviti-lviv/orders/ord-1",
        region: "Замовлення",
        panelSection: "orders",
        pane: "detail",
        listTo: "/$companySlug/orders",
      },
      {
        path: "/kviti-lviv/documents/templates",
        region: "Документи",
        panelSection: "documents",
        pane: "list",
        listTo: "/$companySlug/documents/templates",
      },
      {
        path: "/kviti-lviv/documents/templates/tmpl-1",
        region: "Документи",
        panelSection: "documents",
        pane: "detail",
        listTo: "/$companySlug/documents/templates",
      },
      {
        path: "/kviti-lviv/customers/groups",
        region: "Групи клієнтів",
        panelSection: "customer-groups",
        pane: "list",
        listTo: "/$companySlug/customers/groups",
      },
      {
        path: "/kviti-lviv/customers/groups/g-1",
        region: "Групи клієнтів",
        panelSection: "customer-groups",
        pane: "detail",
        listTo: "/$companySlug/customers/groups",
      },
      {
        path: "/kviti-lviv/customers/counterparties/cp-1",
        region: "Контрагенти",
        panelSection: "counterparties",
        pane: "detail",
        listTo: "/$companySlug/customers/counterparties",
      },
      {
        path: "/kviti-lviv/company/legal",
        region: "Компанія",
        panelSection: "company",
        pane: "detail",
        listTo: "/$companySlug/company",
      },
      {
        path: "/kviti-lviv/documents/templates/tmpl-1/edit",
        panelSection: undefined,
        pane: undefined,
        listTo: undefined,
      },
    ];

    for (const [index, item] of cases.entries()) {
      if (index > 0) {
        cleanup();
        signInWithFlowers();
      }
      const { router } = await renderApp(item.path);
      if (item.region === undefined) {
        expect(
          await screen.findByRole("heading", { name: "Модуль у розробці" }),
        ).toBeDefined();
        expect(document.querySelector(".panel-shell")).toBeNull();
      } else {
        await waitForRegion(item.region);
      }
      expect(router.state.location.pathname).toBe(item.path);
      const resolved = resolvePanelStateFromMatches(router.state.matches);
      expect(resolved?.panelSection).toBe(item.panelSection);
      expect(resolved?.pane).toBe(item.pane);
      expect(resolved?.listTo).toBe(item.listTo);
    }
  });
});

describe("typed Link tabs and nav (SHO-328)", () => {
  it("marks the issued documents tab current, not templates, on /documents", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv/documents");
    await waitForRegion("Документи");
    setShellWidth(1280);
    const region = screen.getByRole("region", { name: "Документи" });
    expect(
      within(region)
        .getByRole("link", { name: "Документи" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(region)
        .getByRole("link", { name: "Шаблони" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marks the templates tab current on the templates list and a template detail", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/documents/templates");
    await waitForRegion("Документи");
    setShellWidth(1280);
    const region = screen.getByRole("region", { name: "Документи" });
    expect(
      within(region)
        .getByRole("link", { name: "Шаблони" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(region)
        .getByRole("link", { name: "Документи" })
        .getAttribute("aria-current"),
    ).toBeNull();

    await act(async () => {
      await router.navigate({
        to: "/$companySlug/documents/templates/$templateId",
        params: { companySlug: "kviti-lviv", templateId: "tmpl-1" },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/documents/templates/tmpl-1",
      );
    });
    const after = screen.getByRole("region", { name: "Документи" });
    expect(
      within(after)
        .getByRole("link", { name: "Шаблони" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(after)
        .getByRole("link", { name: "Документи" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("selects customer groups/counterparties tabs without highlighting the clients tab", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/customers/groups");
    await waitForRegion("Групи клієнтів");
    setShellWidth(1280);
    const groups = screen.getByRole("region", { name: "Групи клієнтів" });
    expect(
      within(groups)
        .getByRole("link", { name: "Групи" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(groups)
        .getByRole("link", { name: "Клієнти" })
        .getAttribute("aria-current"),
    ).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Основна навігація" });
    expect(
      within(nav)
        .getByRole("link", { name: "Клієнти" })
        .getAttribute("aria-current"),
    ).toBe("page");

    await act(async () => {
      await router.navigate({
        to: "/$companySlug/customers/counterparties",
        params: { companySlug: "kviti-lviv" },
      });
    });
    await waitForRegion("Контрагенти");
    const counterparties = screen.getByRole("region", { name: "Контрагенти" });
    expect(
      within(counterparties)
        .getByRole("link", { name: "Контрагенти" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(counterparties)
        .getByRole("link", { name: "Клієнти" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("uses exact matching for company profile / legal / team rows", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/company");
    await waitForRegion("Компанія");
    setShellWidth(1280);
    const region = screen.getByRole("region", { name: "Компанія" });
    expect(
      within(region)
        .getByRole("link", { name: "Профіль" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(region)
        .getByRole("link", { name: "Реквізити" })
        .getAttribute("aria-current"),
    ).toBeNull();

    await act(async () => {
      await router.navigate({
        to: "/$companySlug/company/legal",
        params: { companySlug: "kviti-lviv" },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/company/legal");
    });
    const legal = screen.getByRole("region", { name: "Компанія" });
    expect(
      within(legal)
        .getByRole("link", { name: "Реквізити" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(legal)
        .getByRole("link", { name: "Профіль" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("keeps the issued documents tab current on a document detail and create", async () => {
    signInWithFlowers();
    const cases = [
      "/kviti-lviv/documents/doc-1",
      "/kviti-lviv/documents/new",
    ] as const;
    for (const [index, path] of cases.entries()) {
      if (index > 0) {
        cleanup();
        signInWithFlowers();
      }
      await renderApp(path);
      await waitForRegion("Документи");
      setShellWidth(1280);
      const region = screen.getByRole("region", { name: "Документи" });
      expect(
        within(region)
          .getByRole("link", { name: "Документи" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(
        within(region)
          .getByRole("link", { name: "Шаблони" })
          .getAttribute("aria-current"),
      ).toBeNull();
    }
  });

  it("keeps the clients tab current on a customer detail and create", async () => {
    signInWithFlowers();
    const cases = [
      "/kviti-lviv/customers/c-1",
      "/kviti-lviv/customers/new",
    ] as const;
    for (const [index, path] of cases.entries()) {
      if (index > 0) {
        cleanup();
        signInWithFlowers();
      }
      await renderApp(path);
      await waitForRegion("Клієнти");
      setShellWidth(1280);
      const region = screen.getByRole("region", { name: "Клієнти" });
      expect(
        within(region)
          .getByRole("link", { name: "Клієнти" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(
        within(region)
          .getByRole("link", { name: "Групи" })
          .getAttribute("aria-current"),
      ).toBeNull();
      expect(
        within(region)
          .getByRole("link", { name: "Контрагенти" })
          .getAttribute("aria-current"),
      ).toBeNull();
    }
  });

  it("keeps the orders nav current on the company home URL", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv");
    await waitForRegion("Замовлення");
    setShellWidth(1280);
    expect(
      screen
        .getByRole("link", { name: "Замовлення" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});

describe("phone list/detail and back (SHO-328)", () => {
  it("returns from a group detail to the groups list, not clients", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/customers/groups");
    await waitForRegion("Групи клієнтів");
    setShellWidth(375);
    expect(
      screen.getByRole("region", { name: "Групи клієнтів" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Модуль у розробці" }),
    ).toBeNull();

    await act(async () => {
      await router.navigate({
        to: "/$companySlug/customers/groups/$groupId",
        params: { companySlug: "kviti-lviv", groupId: "g-1" },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/customers/groups/g-1",
      );
    });
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    expect(screen.queryByRole("region", { name: "Групи клієнтів" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/customers/groups",
      );
      expect(
        screen.getByRole("region", { name: "Групи клієнтів" }),
      ).toBeDefined();
      expect(screen.queryByRole("region", { name: "Клієнти" })).toBeNull();
    });
  });

  it("returns from a template detail to templates, not issued documents", async () => {
    signInWithFlowers();
    const { router } = await renderApp(
      "/kviti-lviv/documents/templates/tmpl-1",
    );
    await waitFor(() => {
      expect(document.querySelector(".panel-shell")).not.toBeNull();
    });
    setShellWidth(375);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Модуль у розробці" }),
      ).toBeDefined();
    });
    expect(screen.queryByRole("region", { name: "Документи" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/documents/templates",
      );
      expect(screen.getByRole("region", { name: "Документи" })).toBeDefined();
    });
    const region = screen.getByRole("region", { name: "Документи" });
    expect(
      within(region)
        .getByRole("link", { name: "Шаблони" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("restores the orders list on browser back from a detail", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/orders");
    await waitForRegion("Замовлення");
    setShellWidth(375);
    await act(async () => {
      await router.navigate({
        to: "/$companySlug/orders/$orderId",
        params: { companySlug: "kviti-lviv", orderId: "ord-1" },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders/ord-1");
    });
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    act(() => {
      router.history.back();
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders");
      expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
      expect(
        screen.queryByRole("heading", { name: "Модуль у розробці" }),
      ).toBeNull();
    });
  });
});

describe("full-shell isolation (SHO-328)", () => {
  it("does not mount panel chrome or panel staticData on the template editor", async () => {
    signInWithFlowers();
    const { router } = await renderApp(
      "/kviti-lviv/documents/templates/tmpl-1/edit",
    );
    expect(
      await screen.findByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    expect(document.querySelector(".panel-shell")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(resolvePanelStateFromMatches(router.state.matches)).toBeUndefined();
    expect(
      router.state.matches.some((item) => item.routeId.includes("/_full")),
    ).toBe(true);
    expect(
      router.state.matches.some((item) => item.routeId.includes("/_panel")),
    ).toBe(false);
  });
});
