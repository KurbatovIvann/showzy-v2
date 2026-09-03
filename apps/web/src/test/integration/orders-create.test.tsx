/**
 * Orders create (SHO-379). `/rpc` is mocked with MSW — never module
 * internals. Asserts public URL, RHF validation, retry attempt reuse,
 * LeaveDialog, wire errors by `error.code`, and no catalog prices on
 * the create form. Does not parse pathname prefixes.
 */
import {
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
  seedProduct,
  server,
  sessionState,
} from "../msw";
import {
  ANNA_CUSTOMER,
  ANNA_ORDER,
  CREATED_ORDER_ID,
  CREATED_ORDER_NUMBER,
  ROSE_PRODUCT,
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

function seedCreateLookups(): void {
  listMineState.listOrdersItems = [ANNA_ORDER];
  seedCustomer(ANNA_CUSTOMER);
  seedProduct(ROSE_PRODUCT);
}

function rpcErrorBody(
  code: string,
  status: number,
  message: string,
  data?: unknown,
) {
  const payload: {
    defined: true;
    code: string;
    status: number;
    message: string;
    data?: unknown;
  } = {
    defined: true,
    code,
    status,
    message,
  };
  if (data !== undefined) {
    payload.data = data;
  }
  return HttpResponse.json({ json: payload }, { status });
}

function createCalls(): typeof listMineState.mutationCalls {
  return listMineState.mutationCalls.filter(
    (call) => call.path === "/rpc/orders/create",
  );
}

async function waitForCreateForm(): Promise<HTMLElement> {
  expect(
    await screen.findByRole("heading", { name: copy.create.title }),
  ).toBeDefined();
  const pane = screen.getByRole("region", { name: copy.create.title });
  expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
  expect(
    screen.queryByRole("heading", { name: "Модуль у розробці" }),
  ).toBeNull();
  return pane;
}

async function pickCustomerAndProduct(): Promise<void> {
  fireEvent.click(
    screen.getByRole("button", { name: copy.create.customerPlaceholder }),
  );
  fireEvent.click(await screen.findByRole("option", { name: /Анна Мельник/ }));
  fireEvent.click(
    screen.getByRole("button", { name: copy.create.addProductsPlaceholder }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: ROSE_PRODUCT.name }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Готово · 1" }));
  expect(await screen.findByText(ROSE_PRODUCT.name)).toBeDefined();
}

describe("orders create (SHO-379)", () => {
  it("creates via orders.create and lands on the detail URL", async () => {
    signInWithFlowers();
    seedCreateLookups();
    const { router } = await renderApp("/kviti-lviv/orders/new");
    const pane = await waitForCreateForm();
    expect(within(pane).queryByText("₴")).toBeNull();
    expect(within(pane).queryByText(/500/)).toBeNull();
    expect(within(pane).queryByText("50,00")).toBeNull();
    await pickCustomerAndProduct();
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.submitCreate }),
    );
    expect(
      await screen.findByRole("heading", { name: `#${CREATED_ORDER_NUMBER}` }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe(
      `/kviti-lviv/orders/${CREATED_ORDER_ID}`,
    );
    const writes = createCalls();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.companyId).toBe(FLOWERS_COMPANY_ID);
    expect(writes[0]?.idempotencyKey?.length).toBeGreaterThan(0);
    expect(writes[0]?.input).toEqual({
      customer: { by: "id", id: ANNA_CUSTOMER.id },
      items: [
        {
          product: { by: "id", id: ROSE_PRODUCT.id },
          quantity: { milli: "1000" },
        },
      ],
    });
    expect(
      listMineState.calls.every(
        (call) => call.path !== "/rpc/pricing/resolveProductPrices",
      ),
    ).toBe(true);
    expect(
      listMineState.calls.every(
        (call) => call.path !== "/rpc/customers/create",
      ),
    ).toBe(true);
    expect(screen.getByRole("region", { name: "Замовлення" })).toBeDefined();
  });

  it("requires a customer and at least one item", async () => {
    signInWithFlowers();
    seedCreateLookups();
    await renderApp("/kviti-lviv/orders/new");
    await waitForCreateForm();
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.submitCreate }),
    );
    expect(
      await screen.findByRole("alert", {
        name: copy.create.errors.customerRequired,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("alert", { name: copy.create.errors.itemsRequired }),
    ).toBeDefined();
    expect(createCalls()).toHaveLength(0);
  });

  it("retries the same create attempt after a network failure", async () => {
    signInWithFlowers();
    seedCreateLookups();
    listMineState.orderCreateNetworkFailuresRemaining = 1;
    const { router } = await renderApp("/kviti-lviv/orders/new");
    await waitForCreateForm();
    await pickCustomerAndProduct();
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.submitCreate }),
    );
    expect(await screen.findByText(copy.create.errors.network)).toBeDefined();
    expect(createCalls()).toHaveLength(1);
    const firstKey = createCalls()[0]?.idempotencyKey;
    expect(firstKey?.length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.submitCreate }),
    );
    expect(
      await screen.findByRole("heading", { name: `#${CREATED_ORDER_NUMBER}` }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe(
      `/kviti-lviv/orders/${CREATED_ORDER_ID}`,
    );
    const writes = createCalls();
    expect(writes).toHaveLength(2);
    expect(writes[0]?.idempotencyKey).toBe(writes[1]?.idempotencyKey);
    expect(writes[0]?.input).toEqual(writes[1]?.input);
  });

  it("asks to leave when the dirty form navigates away", async () => {
    signInWithFlowers();
    seedCreateLookups();
    const { router } = await renderApp("/kviti-lviv/orders/new");
    await waitForCreateForm();
    fireEvent.change(screen.getByLabelText(copy.create.commentLabel), {
      target: { value: "Упакувати окремо" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.create.cancel }));
    expect(
      await screen.findByRole("dialog", { name: copy.create.leaveTitle }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/kviti-lviv/orders/new");
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.leaveContinue }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(router.state.location.pathname).toBe("/kviti-lviv/orders/new");
    fireEvent.click(screen.getByRole("button", { name: copy.create.cancel }));
    expect(
      await screen.findByRole("dialog", { name: copy.create.leaveTitle }),
    ).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.leaveConfirm }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv/orders");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("maps PERMISSION_DENIED by error.code, never error.message", async () => {
    signInWithFlowers();
    seedCreateLookups();
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/orders/create`, () =>
        rpcErrorBody("PERMISSION_DENIED", 403, "do-not-match-this"),
      ),
    );
    await renderApp("/kviti-lviv/orders/new");
    await waitForCreateForm();
    await pickCustomerAndProduct();
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.submitCreate }),
    );
    expect(
      await screen.findByText(copy.create.errors.permission),
    ).toBeDefined();
    expect(screen.queryByText("do-not-match-this")).toBeNull();
  });

  it("maps VALIDATION issues onto fields by path, never by message", async () => {
    signInWithFlowers();
    seedCreateLookups();
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/orders/create`, () =>
        rpcErrorBody("VALIDATION", 400, "do-not-match-this", {
          issues: [{ code: "too_small", path: ["items"], message: "secret" }],
        }),
      ),
    );
    await renderApp("/kviti-lviv/orders/new");
    await waitForCreateForm();
    await pickCustomerAndProduct();
    fireEvent.click(
      screen.getByRole("button", { name: copy.create.submitCreate }),
    );
    expect(
      await screen.findByText(copy.create.errors.itemsRequired),
    ).toBeDefined();
    expect(screen.queryByText("do-not-match-this")).toBeNull();
    expect(screen.queryByText("secret")).toBeNull();
  });
});
