/**
 * Orders list (SHO-377). `/rpc` is mocked with MSW — never module internals.
 * Asserts public URL, headings, chips, and RPC input. Does not parse
 * pathname prefixes to decide the pane.
 */
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BAKERY_MEMBERSHIP,
  FLOWERS_COMPANY_ID,
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "../company-fixtures";
import {
  ANNA_CUSTOMER,
  ANNA_ORDER,
  ANNA_ORDER_DETAIL,
  ANNA_ORDER_ID,
  DONE_ORDER,
} from "../orders-fixtures";
import {
  listMineState,
  PANEL_ORIGIN,
  seedCustomer,
  seedOrderDetail,
  server,
  sessionState,
} from "../msw";
import { renderApp } from "../render";

afterEach(cleanup);

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}

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

function seedOrders(): void {
  listMineState.listOrdersItems = [ANNA_ORDER, DONE_ORDER];
  seedOrderDetail(ANNA_ORDER_DETAIL);
  seedCustomer(ANNA_CUSTOMER);
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

async function waitForOrdersList(): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector(".panel-shell")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
  });
}

function ordersListCalls(): typeof listMineState.listOrdersCalls {
  return listMineState.listOrdersCalls;
}

function lastOrdersListInput(): unknown {
  return ordersListCalls().at(-1)?.input;
}

describe("orders list (SHO-377)", () => {
  it("shows the list heading, groups, and rows on /{slug}/orders", async () => {
    signInWithFlowers();
    seedOrders();
    await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    const list = screen.getByRole("region", { name: "Замовлення" });
    expect(within(list).getByText("Замовлення")).toBeDefined();
    expect(within(list).getByText("Квіти Львів")).toBeDefined();
    expect(await screen.findByText("Анна Мельник")).toBeDefined();
    expect(
      screen.getByText("#KL-K7K3K4 · 3 позиції · 15 бер. 2026"),
    ).toBeDefined();
    expect(screen.getByText("Клієнт видалений")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Активні · 1" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Закриті · 1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "В роботі" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: /В роботі/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Завершені/ })).toBeNull();
    expect(screen.queryByText("Завершені")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Оберіть елемент" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Модуль у розробці" }),
    ).toBeNull();
    const create = screen.getByRole("link", { name: "+ Нове" });
    expect(create).toBeDefined();
    expect(create.className).toContain("bg-ink");
    expect(create.className).toContain("text-white");
    expect(create.className).not.toContain("text-action");
  });

  it("keeps search and status search params after a reload", async () => {
    signInWithFlowers();
    seedOrders();
    const { router } = await renderApp(
      "/kviti-lviv/orders?q=anna&status=confirmed",
    );
    await waitForOrdersList();
    await waitFor(() => {
      expect(ordersListCalls().length).toBeGreaterThan(0);
    });
    expect(router.state.location.search).toEqual({
      q: "anna",
      status: "confirmed",
    });
    expect(screen.getByDisplayValue("anna")).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "Підтверджено" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(lastOrdersListInput()).toEqual({
      kind: "page.summary",
      filter: { query: "anna", statuses: ["confirmed"] },
    });
  });

  it("omits filter.statuses when the chip is Усі", async () => {
    signInWithFlowers();
    seedOrders();
    await renderApp("/kviti-lviv/orders?status=new");
    await waitForOrdersList();
    await waitFor(() => {
      expect(lastOrdersListInput()).toEqual({
        kind: "page.summary",
        filter: { statuses: ["new"] },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Усі" }));
    await waitFor(() => {
      expect(lastOrdersListInput()).toEqual({ kind: "page.summary" });
    });
    const input = lastOrdersListInput();
    expect(JSON.stringify(input)).not.toContain("statuses");
    expect(JSON.stringify(input)).not.toContain("all");
    expect(JSON.stringify(input)).not.toContain("active");
    expect(JSON.stringify(input)).not.toContain("completed");
    expect(
      screen.getByRole("button", { name: "Усі" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps the list mounted when a row is selected at desktop width", async () => {
    signInWithFlowers();
    seedOrders();
    const { router } = await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    setShellWidth(1280);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("desktop");
    const row = await screen.findByRole("link", { name: /Анна Мельник/ });
    expect(row.getAttribute("href")).toBe(
      `/kviti-lviv/orders/${ANNA_ORDER_ID}`,
    );
    fireEvent.click(row);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/kviti-lviv/orders/${ANNA_ORDER_ID}`,
      );
      expect(screen.getByRole("heading", { name: "#KL-K7K3K4" })).toBeDefined();
    });
    expect(
      screen.queryByRole("heading", { name: "Модуль у розробці" }),
    ).toBeNull();
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByText("Анна Мельник").length).toBeGreaterThan(1);
    });
    expect(
      screen.queryByRole("heading", { name: "Оберіть елемент" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /Анна Мельник/ })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      ordersListCalls().every((call) => call.companyId === FLOWERS_COMPANY_ID),
    ).toBe(true);
  });

  it("hides + Нове when the selected membership lacks orders:create", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [
      {
        ...FLOWERS_MEMBERSHIP,
        role: "employee",
        permissions: ["orders:edit", "orders:view"],
      },
    ];
    seedOrders();
    await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    expect(await screen.findByText("Анна Мельник")).toBeDefined();
    expect(screen.queryByRole("link", { name: "+ Нове" })).toBeNull();
  });

  it("hides catalog-empty create when orders:create is denied", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [
      {
        ...FLOWERS_MEMBERSHIP,
        role: "employee",
        permissions: ["orders:edit", "orders:view"],
      },
    ];
    await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    expect(await screen.findByText("Замовлень ще немає")).toBeDefined();
    expect(screen.queryByRole("link", { name: "+ Нове" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Нове замовлення" })).toBeNull();
  });

  it("uses the selected membership's create permission after a company switch", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [
      FLOWERS_MEMBERSHIP,
      {
        ...BAKERY_MEMBERSHIP,
        role: "employee",
        permissions: ["orders:edit", "orders:view"],
      },
    ];
    seedOrders();
    const { router } = await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    expect(screen.getByRole("link", { name: "+ Нове" })).toBeDefined();
    fireEvent.click(screen.getByRole("link", { name: "Пекарня" }));
    expect(
      await screen.findByRole("heading", { name: "Пекарня" }),
    ).toBeDefined();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pekarnya");
    });
    fireEvent.click(screen.getByRole("link", { name: "Замовлення" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pekarnya/orders");
    });
    await waitForOrdersList();
    expect(screen.queryByRole("link", { name: "+ Нове" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Нове замовлення" })).toBeNull();
  });

  it("shows catalog-empty when there are no orders", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    expect(await screen.findByText("Замовлень ще немає")).toBeDefined();
    expect(screen.queryByText("Нічого не знайдено")).toBeNull();
    expect(screen.queryByRole("link", { name: "+ Нове" })).toBeNull();
    const emptyCreate = screen.getByRole("link", { name: "Нове замовлення" });
    expect(emptyCreate.className).toContain("bg-ink");
    fireEvent.click(emptyCreate);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders/new");
    });
  });

  it("shows filtered-empty when the query matches nothing", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv/orders?q=немає-такого");
    await waitForOrdersList();
    expect(await screen.findByText("Нічого не знайдено")).toBeDefined();
    expect(screen.queryByText("Замовлень ще немає")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Скинути пошук і фільтри" }),
    );
    await waitFor(() => {
      expect(screen.getByText("Замовлень ще немає")).toBeDefined();
    });
  });

  it("shows a loading status before the list page arrives", async () => {
    signInWithFlowers();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/orders/list`, async () => {
        await gate;
        return HttpResponse.json({
          json: {
            kind: "page.summary",
            items: [],
            nextCursor: null,
            customerMatchTruncated: false,
          },
        });
      }),
    );
    await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    expect(
      await screen.findByRole("status", { name: "Завантаження замовлень" }),
    ).toBeDefined();
    release?.();
    expect(await screen.findByText("Замовлень ще немає")).toBeDefined();
  });

  it("hides the empty-selection heading on the phone list", async () => {
    signInWithFlowers();
    seedOrders();
    await renderApp("/kviti-lviv/orders");
    await waitForOrdersList();
    setShellWidth(375);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("phone");
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Оберіть елемент" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Модуль у розробці" }),
    ).toBeNull();
  });
});
