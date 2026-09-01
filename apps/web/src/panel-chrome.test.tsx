/**
 * Panel chrome (SHO-314). `/rpc` is mocked with MSW — never module internals.
 * Pane collapse follows shell width via ResizeObserver, not the viewport.
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "./test/company-fixtures";
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

async function setShellWidth(width: number): Promise<void> {
  const shell = document.querySelector(".panel-shell");
  expect(shell).not.toBeNull();
  Object.defineProperty(shell, "clientWidth", {
    configurable: true,
    value: width,
  });
  await act(() => {
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
    await setShellWidth(1280);
    expect(document.querySelector(".panel-shell")?.getAttribute("data-shell")).toBe(
      "desktop",
    );
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Меню" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Модуль у розробці" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Замовлення" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(router.state.location.pathname).toBe("/kviti-lviv");
  });

  it("shows hamburger drawer and both panes at tablet shell width (768–1023)", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    await setShellWidth(800);
    expect(document.querySelector(".panel-shell")?.getAttribute("data-shell")).toBe(
      "tablet",
    );
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Меню" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Модуль у розробці" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(
      screen.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeDefined();
  });

  it("XORs list and detail and shows bottom tabs at phone shell width (<768)", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    await setShellWidth(375);
    expect(document.querySelector(".panel-shell")?.getAttribute("data-shell")).toBe(
      "phone",
    );
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Меню" })).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Мобільна навігація" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Більше" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Модуль у розробці" })).toBeNull();
    expect(screen.getByText("Замовлення")).toBeDefined();

    await act(async () => {
      await router.navigate({
        to: "/$companySlug/orders/$orderId",
        params: { companySlug: "kviti-lviv", orderId: "ord-1" },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders/ord-1");
    });
    expect(screen.getByRole("heading", { name: "Модуль у розробці" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Назад до списку" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders");
    });
    expect(screen.queryByRole("heading", { name: "Модуль у розробці" })).toBeNull();
  });
});

describe("panel chrome nav (SHO-314)", () => {
  it("selects the nav row that matches the route", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    await setShellWidth(1280);
    fireEvent.click(screen.getByRole("link", { name: "Товари" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/products");
    });
    expect(screen.getByRole("link", { name: "Товари" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Замовлення" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("panel chrome account menu (SHO-314)", () => {
  it("keeps Вийти inside the account dropdown and signs out to /sign-in", async () => {
    signInWithFlowers();
    const { router } = await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    await setShellWidth(1280);
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

describe("panel chrome mobile more sheet (SHO-314)", () => {
  it("renders Більше groups Операції / Клієнти / Налаштування", async () => {
    signInWithFlowers();
    await renderApp("/kviti-lviv");
    await screen.findByRole("heading", { name: "Квіти Львів" });
    await setShellWidth(375);
    fireEvent.click(screen.getByRole("button", { name: "Більше" }));
    expect(screen.getByText("Операції")).toBeDefined();
    expect(screen.getByText("Налаштування")).toBeDefined();
    expect(screen.getByRole("button", { name: "Документи" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Групи клієнтів" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Контрагенти" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Запрошення" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Компанія" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Шозік" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Вийти" })).toBeDefined();
    const groupTitles = screen.getAllByText("Клієнти");
    expect(groupTitles.length).toBeGreaterThan(0);
  });
});
