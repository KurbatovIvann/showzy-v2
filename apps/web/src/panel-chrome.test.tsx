/**
 * Panel chrome (SHO-314). `/rpc` is mocked with MSW — never module internals.
 * Pane collapse follows shell width via ResizeObserver, not the viewport.
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

describe("panel chrome breakpoints (SHO-314)", () => {
  it("shows nav | list | detail at desktop shell width (≥1024)", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    setShellWidth(1280);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("desktop");
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Меню" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Замовлення" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(router.state.location.pathname).toBe("/kviti-lviv");
  });

  it("shows hamburger drawer and both panes at tablet shell width (768–1023)", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(800);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("tablet");
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Меню" })).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
  });

  it("does not reopen the tablet drawer after leaving tablet and returning", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(800);
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
    setShellWidth(1280);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("desktop");
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
    setShellWidth(800);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("tablet");
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Меню" })).toBeDefined();
  });

  it("XORs list and detail and shows bottom tabs at phone shell width (<768)", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(375);
    expect(
      document.querySelector(".panel-shell")?.getAttribute("data-shell"),
    ).toBe("phone");
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Меню" })).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Більше" })).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Модуль у розробці" }),
    ).toBeNull();
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();

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
    expect(
      screen.getByRole("button", { name: "Назад до списку" }),
    ).toBeDefined();
    expect(screen.queryByRole("region", { name: "Замовлення" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders");
    });
    expect(
      screen.queryByRole("heading", { name: "Модуль у розробці" }),
    ).toBeNull();
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
  });
});

describe("panel chrome nav (SHO-314)", () => {
  it("selects the nav row that matches the route", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(1280);
    fireEvent.click(screen.getByRole("link", { name: "Товари" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/products");
    });
    expect(
      screen.getByRole("link", { name: "Товари" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Замовлення" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("keeps sidebar rows flat: no nested Групи/Контрагенти; Запрошення is first-class", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(1280);
    const nav = screen.getByRole("navigation", { name: "Основна навігація" });
    expect(within(nav).getByRole("link", { name: "Клієнти" })).toBeDefined();
    expect(within(nav).getByRole("link", { name: "Запрошення" })).toBeDefined();
    expect(within(nav).queryByRole("link", { name: "Групи" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Контрагенти" })).toBeNull();
    fireEvent.click(within(nav).getByRole("link", { name: "Клієнти" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/customers");
    });
    expect(screen.getByRole("link", { name: "Групи" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Контрагенти" })).toBeDefined();
    expect(within(nav).queryByRole("link", { name: "Групи" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Контрагенти" })).toBeNull();
  });
});

describe("panel chrome account menu (SHO-314)", () => {
  it("keeps Вийти inside the account dropdown and signs out to /sign-in", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(1280);
    expect(screen.queryByRole("menuitem", { name: "Вийти" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Меню акаунта" }));
    expect(screen.getByRole("menuitem", { name: "Вийти" })).toBeDefined();
    fireEvent.click(screen.getByRole("menuitem", { name: "Вийти" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
    expect(await screen.findByRole("heading", { name: "ШОЗІ" })).toBeDefined();
  });
});

describe("full-shell template editor (SHO-314)", () => {
  it("keeps three-pane chrome on non-edit documents routes", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv/documents");
    expect(
      await screen.findByRole("region", { name: "Документи" }),
    ).toBeDefined();
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/kviti-lviv/documents");
  });

  it("renders the editor placeholder outside panel chrome; back returns to templates", async () => {
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
    expect(document.querySelector(".panel-shell")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Документи" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Більше" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Назад до списку" }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/kviti-lviv/documents/templates",
      );
    });
    expect(screen.getByRole("region", { name: "Документи" })).toBeDefined();
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
  });
});

describe("panel chrome mobile more sheet (SHO-314)", () => {
  it("renders Більше groups Операції / Клієнти / Налаштування", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    setShellWidth(375);
    fireEvent.click(screen.getByRole("button", { name: "Більше" }));
    expect(screen.getByText("Операції")).toBeDefined();
    expect(screen.getByText("Налаштування")).toBeDefined();
    expect(screen.getByRole("button", { name: "Документи" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Групи клієнтів" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Контрагенти" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Запрошення" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Компанія" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Шозік" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Вийти" })).toBeDefined();
    const groupTitles = screen.getAllByText("Клієнти");
    expect(groupTitles.length).toBeGreaterThan(0);
  });
});
