/**
 * Orders detail (SHO-378). `/rpc` is mocked with MSW — never module
 * internals. Asserts public URL, CTAs, cancel, error banners via
 * `error.code`, and that the parent list stays mounted. Does not parse
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

import { ordersCopy } from "../../i18n/orders";
import {
  FLOWERS_COMPANY_ID,
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "../company-fixtures";
import {
  listMineState,
  PANEL_ORIGIN,
  seedCustomer,
  seedOrderDetail,
  seedProduct,
  server,
  sessionState,
} from "../msw";
import {
  ANNA_CUSTOMER,
  ANNA_ORDER,
  ANNA_ORDER_DETAIL,
  ANNA_ORDER_ID,
  CONFIRMED_ORDER,
  CONFIRMED_ORDER_DETAIL,
  CONFIRMED_ORDER_ID,
  DONE_ORDER,
  DONE_ORDER_DETAIL,
  DONE_ORDER_ID,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_ORDER_DETAIL,
  IN_PROGRESS_ORDER_ID,
  ROSE_FILE_ID,
  ROSE_PRODUCT,
  ROSE_PRODUCT_WITH_IMAGE,
  ROSE_THUMB_URL,
} from "../orders-fixtures";
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

const copy = ordersCopy("uk");

function signInWithFlowers(): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = [FLOWERS_MEMBERSHIP];
}

function seedCatalog(): void {
  listMineState.listOrdersItems = [
    ANNA_ORDER,
    CONFIRMED_ORDER,
    IN_PROGRESS_ORDER,
    DONE_ORDER,
  ];
  seedOrderDetail(ANNA_ORDER_DETAIL);
  seedOrderDetail(CONFIRMED_ORDER_DETAIL);
  seedOrderDetail(IN_PROGRESS_ORDER_DETAIL);
  seedOrderDetail(DONE_ORDER_DETAIL);
  seedCustomer(ANNA_CUSTOMER);
  seedProduct(ROSE_PRODUCT);
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

function rpcErrorBody(code: string, status: number, message: string) {
  return HttpResponse.json(
    {
      json: {
        defined: true,
        code,
        status,
        message,
      },
    },
    { status },
  );
}

function statusWrites(): typeof listMineState.mutationCalls {
  return listMineState.mutationCalls.filter((call) =>
    call.path.startsWith("/rpc/orders/"),
  );
}

const CTA_CASES: ReadonlyArray<{
  readonly name: string;
  readonly orderId: string;
  readonly heading: string;
  readonly cta: string;
  readonly hidden: readonly string[];
}> = [
  {
    name: "new",
    orderId: ANNA_ORDER_ID,
    heading: "#KL-K7K3K4",
    cta: "Підтвердити",
    hidden: ["В роботу", "Виконано"],
  },
  {
    name: "confirmed",
    orderId: CONFIRMED_ORDER_ID,
    heading: "#KL-CONF",
    cta: "В роботу",
    hidden: ["Підтвердити", "Виконано"],
  },
  {
    name: "in_progress",
    orderId: IN_PROGRESS_ORDER_ID,
    heading: "#KL-WORK",
    cta: "Виконано",
    hidden: ["Підтвердити", "В роботу"],
  },
];

const CANCEL_CASES: ReadonlyArray<{
  readonly name: string;
  readonly orderId: string;
  readonly heading: string;
}> = [
  { name: "new", orderId: ANNA_ORDER_ID, heading: "#KL-K7K3K4" },
  { name: "confirmed", orderId: CONFIRMED_ORDER_ID, heading: "#KL-CONF" },
  {
    name: "in_progress",
    orderId: IN_PROGRESS_ORDER_ID,
    heading: "#KL-WORK",
  },
];

describe("orders detail (SHO-378)", () => {
  it("deep-links /{slug}/orders/{id} to snapshot lines, comment, and phone", async () => {
    signInWithFlowers();
    seedCatalog();
    const { router } = await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    expect(
      await screen.findByRole("heading", { name: "#KL-K7K3K4" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe(
      `/kviti-lviv/orders/${ANNA_ORDER_ID}`,
    );
    const detail = screen.getByRole("region", { name: "#KL-K7K3K4" });
    await waitFor(() => {
      expect(within(detail).getByText("Анна Мельник")).toBeDefined();
      expect(within(detail).getByText("+380671112233")).toBeDefined();
    });
    expect(within(detail).getByText("Нове")).toBeDefined();
    expect(within(detail).getByText("Троянди")).toBeDefined();
    expect(within(detail).getByText("Packed separately")).toBeDefined();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    expect(within(detail).queryByText("Виставити документ")).toBeNull();
    expect(
      listMineState.calls.some(
        (call) =>
          call.path === "/rpc/orders/get" &&
          call.companyId === FLOWERS_COMPANY_ID,
      ),
    ).toBe(true);
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
  });

  it("does not call orders.get for a non-uuid id", async () => {
    signInWithFlowers();
    seedCatalog();
    await renderApp("/kviti-lviv/orders/ord-1");
    expect(
      await screen.findByRole("heading", { name: "Замовлення не знайдено" }),
    ).toBeDefined();
    expect(
      listMineState.calls.every((call) => call.path !== "/rpc/orders/get"),
    ).toBe(true);
  });

  it.each(CTA_CASES)(
    "shows the $name primary write and hides the others",
    async ({ orderId, heading, cta, hidden }) => {
      signInWithFlowers();
      seedCatalog();
      await renderApp(`/kviti-lviv/orders/${orderId}`);
      const detail = await screen.findByRole("region", { name: heading });
      expect(within(detail).getByRole("button", { name: cta })).toBeDefined();
      for (const label of hidden) {
        expect(
          within(detail).queryByRole("button", { name: label }),
        ).toBeNull();
      }
    },
  );

  it("walks confirm → start with distinct mutation attempts and invalidates", async () => {
    signInWithFlowers();
    seedCatalog();
    await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    const detail = await screen.findByRole("region", { name: "#KL-K7K3K4" });
    fireEvent.click(
      within(detail).getByRole("button", { name: "Підтвердити" }),
    );
    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "#KL-K7K3K4" })).getByRole(
          "button",
          { name: "В роботу" },
        ),
      ).toBeDefined();
    });
    const afterConfirm = statusWrites();
    expect(afterConfirm).toHaveLength(1);
    expect(afterConfirm[0]?.path).toBe("/rpc/orders/confirm");
    expect(afterConfirm[0]?.companyId).toBe(FLOWERS_COMPANY_ID);
    expect(afterConfirm[0]?.idempotencyKey).toEqual(expect.any(String));
    fireEvent.click(
      within(screen.getByRole("region", { name: "#KL-K7K3K4" })).getByRole(
        "button",
        { name: "В роботу" },
      ),
    );
    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "#KL-K7K3K4" })).getByRole(
          "button",
          { name: "Виконано" },
        ),
      ).toBeDefined();
    });
    const writes = statusWrites();
    expect(writes.map((call) => call.path)).toEqual([
      "/rpc/orders/confirm",
      "/rpc/orders/start",
    ]);
    expect(writes[0]?.idempotencyKey).not.toBe(writes[1]?.idempotencyKey);
  });

  it.each(CANCEL_CASES)(
    "cancels from the $name ⋯ menu",
    async ({ orderId, heading }) => {
      signInWithFlowers();
      seedCatalog();
      await renderApp(`/kviti-lviv/orders/${orderId}`);
      const detail = await screen.findByRole("region", { name: heading });
      fireEvent.click(
        within(detail).getByRole("button", { name: copy.detail.actionsLabel }),
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "Скасувати" }));
      await waitFor(() => {
        const pane = screen.getByRole("region", { name: heading });
        expect(within(pane).getByText("Скасовано")).toBeDefined();
        expect(
          within(pane).queryByRole("button", {
            name: copy.detail.actionsLabel,
          }),
        ).toBeNull();
        expect(
          within(pane).queryByRole("button", { name: "Підтвердити" }),
        ).toBeNull();
        expect(
          within(pane).queryByRole("button", { name: "В роботу" }),
        ).toBeNull();
        expect(
          within(pane).queryByRole("button", { name: "Виконано" }),
        ).toBeNull();
      });
      expect(
        statusWrites().some((call) => call.path === "/rpc/orders/cancel"),
      ).toBe(true);
    },
  );

  it("hides writes on a done order", async () => {
    signInWithFlowers();
    seedCatalog();
    await renderApp(`/kviti-lviv/orders/${DONE_ORDER_ID}`);
    const detail = await screen.findByRole("region", { name: "#KL-CLOSED" });
    expect(within(detail).getByText("Виконано")).toBeDefined();
    expect(
      within(detail).queryByRole("button", { name: "Підтвердити" }),
    ).toBeNull();
    expect(
      within(detail).queryByRole("button", { name: "В роботу" }),
    ).toBeNull();
    expect(
      within(detail).queryByRole("button", { name: "Виконано" }),
    ).toBeNull();
    expect(
      within(detail).queryByRole("button", { name: copy.detail.actionsLabel }),
    ).toBeNull();
  });

  it("maps get failures by error.code and never shows error.message", async () => {
    signInWithFlowers();
    seedCatalog();
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/orders/get`, () =>
        rpcErrorBody("INTERNAL", 500, "secret-server-message"),
      ),
    );
    await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    expect(await screen.findByText(copy.detail.errorTitle)).toBeDefined();
    expect(screen.queryByText("secret-server-message")).toBeNull();
    expect(
      screen.getByRole("button", { name: copy.detail.retry }),
    ).toBeDefined();
  });

  it("maps confirm network failures to the offline banner via error.code", async () => {
    signInWithFlowers();
    seedCatalog();
    await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    const detail = await screen.findByRole("region", { name: "#KL-K7K3K4" });
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/orders/confirm`, () =>
        HttpResponse.error(),
      ),
    );
    fireEvent.click(
      within(detail).getByRole("button", { name: "Підтвердити" }),
    );
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe(
      copy.detail.mutationOffline,
    );
    expect(screen.queryByText("Failed to fetch")).toBeNull();
  });

  it("maps permission-denied writes by error.code, never message text", async () => {
    signInWithFlowers();
    seedCatalog();
    await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    const detail = await screen.findByRole("region", { name: "#KL-K7K3K4" });
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/orders/confirm`, () =>
        rpcErrorBody("PERMISSION_DENIED", 403, "secret-denied-message"),
      ),
    );
    fireEvent.click(
      within(detail).getByRole("button", { name: "Підтвердити" }),
    );
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe(
      copy.detail.mutationPermission,
    );
    expect(screen.queryByText("secret-denied-message")).toBeNull();
  });

  it("keeps list search/status/selection in the URL while the parent list stays mounted", async () => {
    signInWithFlowers();
    seedCatalog();
    const { router } = await renderApp(
      `/kviti-lviv/orders/${ANNA_ORDER_ID}?q=anna&status=new`,
    );
    expect(
      await screen.findByRole("heading", { name: "#KL-K7K3K4" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe(
      `/kviti-lviv/orders/${ANNA_ORDER_ID}`,
    );
    expect(router.state.location.search).toEqual({
      q: "anna",
      status: "new",
    });
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
    expect(screen.getByDisplayValue("anna")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: /Анна Мельник/ })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.queryByRole("heading", { name: "Оберіть елемент" }),
    ).toBeNull();
  });

  it("navigates phone back to the typed list route without dropping search", async () => {
    signInWithFlowers();
    seedCatalog();
    const { router } = await renderApp(
      `/kviti-lviv/orders/${ANNA_ORDER_ID}?q=anna&status=new`,
    );
    await waitFor(() => {
      expect(document.querySelector(".panel-shell")).not.toBeNull();
    });
    setShellWidth(375);
    expect(
      await screen.findByRole("heading", { name: "#KL-K7K3K4" }),
    ).toBeDefined();
    expect(screen.queryByRole("region", { name: "Замовлення" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Назад до списку" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders");
      expect(router.state.location.search).toEqual({
        q: "anna",
        status: "new",
      });
      expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
    });
  });

  it("hydrates line thumbs via catalog.getProduct then files.getDownloadUrls with rendition thumb", async () => {
    signInWithFlowers();
    seedCatalog();
    seedProduct(ROSE_PRODUCT_WITH_IMAGE);
    await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    expect(
      await screen.findByRole("heading", { name: "#KL-K7K3K4" }),
    ).toBeDefined();
    await waitFor(() => {
      const img = document.querySelector(`img[data-file-id="${ROSE_FILE_ID}"]`);
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toBe(ROSE_THUMB_URL);
    });
    expect(
      listMineState.calls.some(
        (call) => call.path === "/rpc/catalog/getProduct",
      ),
    ).toBe(true);
    expect(listMineState.getDownloadUrlsCalls).toHaveLength(1);
    expect(listMineState.getDownloadUrlsCalls[0]?.input).toMatchObject({
      fileIds: [ROSE_FILE_ID],
      rendition: "thumb",
    });
    expect(listMineState.getDownloadUrlsCalls[0]?.companyId).toBe(
      FLOWERS_COMPANY_ID,
    );
  });

  it("does not call getDownloadUrls for an employee without files:view", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [{ ...FLOWERS_MEMBERSHIP, role: "employee" }];
    seedCatalog();
    seedProduct(ROSE_PRODUCT_WITH_IMAGE);
    await renderApp(`/kviti-lviv/orders/${ANNA_ORDER_ID}`);
    expect(
      await screen.findByRole("heading", { name: "#KL-K7K3K4" }),
    ).toBeDefined();
    await waitFor(() => {
      expect(
        listMineState.calls.some(
          (call) => call.path === "/rpc/catalog/getProduct",
        ),
      ).toBe(true);
    });
    expect(document.querySelector("img")).toBeNull();
    expect(listMineState.getDownloadUrlsCalls).toEqual([]);
    expect(
      listMineState.calls.some(
        (call) => call.path === "/rpc/files/getDownloadUrls",
      ),
    ).toBe(false);
  });
});
