/**
 * Order create view affordances (SHO-379). Permission hide is proven
 * here because every seeded staff role holds `orders:create`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import { OrderCreateView } from "./order-create-view";
import type { OrderCreateModel } from "./use-order-create";

const copy = ordersCopy("uk");
const NOOP = (): void => undefined;

afterEach(cleanup);

function stubModel(
  overrides: Partial<OrderCreateModel> = {},
): OrderCreateModel {
  return {
    copy,
    formCopy: copy.create,
    loadState: { kind: "ready" },
    customerId: "",
    customerName: "",
    comment: "",
    items: [],
    customerError: null,
    itemsError: null,
    commentError: null,
    banner: null,
    pending: false,
    validating: false,
    submitLabel: copy.create.submitCreate,
    submitDisabled: false,
    fieldsEditable: true,
    showSubmit: true,
    leaveOpen: false,
    customerOpen: false,
    customerQuery: "",
    customers: [],
    customersLoading: false,
    productQuery: "",
    products: [],
    productsLoading: false,
    pickerOpen: false,
    pickerKind: "closed",
    pickerProductName: null,
    pickerSelectedIds: new Set<string>(),
    pickerSelectedVariantIds: new Set<string>(),
    pickerDoneLabel: "Готово · 0",
    variants: [],
    variantsLoading: false,
    variantsError: false,
    pickCustomer: NOOP,
    setCustomerOpen: NOOP,
    setCustomerQuery: NOOP,
    setProductQuery: NOOP,
    openPicker: NOOP,
    closePicker: NOOP,
    toggleSimpleProduct: NOOP,
    openVariants: NOOP,
    closeVariants: NOOP,
    pickVariant: NOOP,
    commitPicker: NOOP,
    stepQuantity: NOOP,
    removeItem: NOOP,
    changeComment: NOOP,
    submit: NOOP,
    stay: NOOP,
    leave: NOOP,
    ...overrides,
  };
}

describe("OrderCreateView (SHO-379)", () => {
  it("hides create submit when orders:create is not granted", () => {
    render(
      <OrderCreateView
        model={stubModel({
          showSubmit: false,
          fieldsEditable: false,
          submitDisabled: true,
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(screen.queryByRole("button", { name: "Створити" })).toBeNull();
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeDefined();
  });

  it("shows the permission empty state instead of the form", () => {
    render(
      <OrderCreateView
        model={stubModel({
          loadState: { kind: "permission" },
          showSubmit: false,
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(
      screen.getByRole("heading", { name: copy.create.permissionTitle }),
    ).toBeDefined();
    expect(screen.getByText(copy.create.permissionDescription)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Створити" })).toBeNull();
    expect(screen.queryByText("Оберіть клієнта")).toBeNull();
  });
});
