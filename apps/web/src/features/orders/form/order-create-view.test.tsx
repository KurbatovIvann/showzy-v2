/**
 * Order create view affordances (SHO-379 / SHO-438). Permission hide is
 * proven here; listMine effective keys drive `loadState` in the composer.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import {
  ROSE_FILE_ID,
  ROSE_PRODUCT,
  ROSE_PRODUCT_ID,
  ROSE_THUMB_URL,
} from "../../../test/orders-fixtures";
import { OrderCreateView } from "./order-create-view";
import { lineIdentityKeySet } from "./product-picker";
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
    customerPhone: null,
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
    customersError: null,
    retryCustomers: NOOP,
    productQuery: "",
    products: [],
    productsLoading: false,
    productsError: null,
    retryProducts: NOOP,
    pickerOpen: false,
    pickerKind: "closed",
    pickerProductName: null,
    pickerProductId: null,
    pickerPicks: [],
    pickerSelectedIds: new Set<string>(),
    pickerSelectedVariantIds: new Set<string>(),
    pickerPickCount: 0,
    pickerAddLabel: "Додати · 0",
    existingLineKeys: new Set<string>(),
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
    setQuantityUnits: NOOP,
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

  it("shows a customer list error with retry, not empty-catalog copy", () => {
    render(
      <OrderCreateView
        model={stubModel({
          customerOpen: true,
          customersError: copy.create.customersError,
          customers: [],
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(screen.getByText(copy.create.customersError)).toBeDefined();
    expect(
      screen.getByRole("button", { name: copy.create.lookupRetry }),
    ).toBeDefined();
    expect(screen.queryByText(copy.create.emptyCustomers)).toBeNull();
  });

  it("shows a product list error with retry, not empty-catalog copy", () => {
    render(
      <OrderCreateView
        model={stubModel({
          pickerOpen: true,
          pickerKind: "products",
          productsError: copy.create.productsError,
          products: [],
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(screen.getByText(copy.create.productsError)).toBeDefined();
    expect(
      screen.getByRole("button", { name: copy.create.lookupRetry }),
    ).toBeDefined();
    expect(screen.queryByText(copy.create.emptyProducts)).toBeNull();
  });

  it("renders line thumbnails from the parent-batched signed URL", () => {
    render(
      <OrderCreateView
        model={stubModel({
          items: [
            {
              key: "line-1",
              productId: ROSE_PRODUCT_ID,
              productName: "Троянди",
              variantName: null,
              quantityLabel: "3",
              thumbnailFileId: ROSE_FILE_ID,
              thumbnailUrl: ROSE_THUMB_URL,
              thumbnailFailed: false,
            },
          ],
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    const img = document.querySelector(`img[data-file-id="${ROSE_FILE_ID}"]`);
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(ROSE_THUMB_URL);
  });

  it("renders picker thumbnails next to product names", () => {
    render(
      <OrderCreateView
        model={stubModel({
          pickerOpen: true,
          pickerKind: "products",
          products: [
            {
              ...ROSE_PRODUCT,
              thumbnailFileId: ROSE_FILE_ID,
              thumbnailUrl: ROSE_THUMB_URL,
              thumbnailFailed: false,
            },
          ],
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(screen.getByText("Троянди")).toBeDefined();
    const img = document.querySelector(`img[data-file-id="${ROSE_FILE_ID}"]`);
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(ROSE_THUMB_URL);
  });

  it("shows Close when the picker draft is empty and Add when it has picks", () => {
    const { rerender } = render(
      <OrderCreateView
        model={stubModel({
          pickerOpen: true,
          pickerKind: "products",
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: copy.create.productSheetClose })
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Додати · 1" })).toBeNull();
    rerender(
      <OrderCreateView
        model={stubModel({
          pickerOpen: true,
          pickerKind: "products",
          pickerPickCount: 1,
          pickerAddLabel: "Додати · 1",
          pickerPicks: [
            {
              productId: ROSE_PRODUCT_ID,
              variantId: null,
              productName: ROSE_PRODUCT.name,
              variantName: null,
            },
          ],
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(screen.getByRole("button", { name: "Додати · 1" })).toBeDefined();
  });

  it("disables a simple product already on the order", () => {
    render(
      <OrderCreateView
        model={stubModel({
          pickerOpen: true,
          pickerKind: "products",
          existingLineKeys: lineIdentityKeySet([
            { productId: ROSE_PRODUCT_ID, variantId: null },
          ]),
          products: [
            {
              ...ROSE_PRODUCT,
              thumbnailFileId: null,
              thumbnailUrl: null,
              thumbnailFailed: false,
            },
          ],
        })}
        showBack={false}
        onBack={NOOP}
      />,
    );
    expect(
      screen.getByRole("button", { name: ROSE_PRODUCT.name }),
    ).toHaveProperty("disabled", true);
  });

  it("uses the dashed dropzone copy when the draft has no lines", () => {
    render(
      <OrderCreateView model={stubModel()} showBack={false} onBack={NOOP} />,
    );
    expect(
      screen.getByRole("button", {
        name: copy.create.addProductsPlaceholder,
      }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: copy.create.addProductsLabel }),
    ).toBeNull();
  });
});
