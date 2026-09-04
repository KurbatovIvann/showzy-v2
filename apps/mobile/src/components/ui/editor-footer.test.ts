import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./editor-footer.tsx", import.meta.url),
  "utf8",
);
const SCAFFOLD = readFileSync(
  new URL("../form-kit/form-screen-scaffold.tsx", import.meta.url),
  "utf8",
);
const PRODUCT_FORM = readFileSync(
  new URL(
    "../../features/catalog/products/form/product-form-view.tsx",
    import.meta.url,
  ),
  "utf8",
);
const PRODUCT_DETAIL = readFileSync(
  new URL(
    "../../features/catalog/products/detail/product-detail-view.tsx",
    import.meta.url,
  ),
  "utf8",
);
const ORDER_FORM = readFileSync(
  new URL("../../features/orders/form/order-form-view.tsx", import.meta.url),
  "utf8",
);

describe("EditorFooter canvas spec card (SHO-390)", () => {
  it("is a floating card with nav shadow, not a border-top dock", () => {
    expect(SOURCE).toContain("theme.shadows.nav");
    expect(SOURCE).toContain("theme.radii.card");
    expect(SOURCE).toContain("theme.squircle");
    expect(SOURCE).not.toContain("borderTopWidth");
    expect(SOURCE).toContain("<Button");
    expect(SOURCE).toContain("fullWidth");
    expect(SOURCE).toContain('variant="secondary"');
  });

  it("does not embed Ukrainian plural copy; consumers pass labels", () => {
    expect(SOURCE).not.toContain("Без позицій");
    expect(SOURCE).not.toContain("позиція");
    expect(SOURCE).not.toContain("Скасувати");
    expect(SOURCE).not.toContain("До сплати");
  });

  it("is the shared footer for the scaffold and product/order docks", () => {
    expect(SCAFFOLD).toContain("EditorFooter");
    expect(SCAFFOLD).toContain("footerLeading");
    expect(SCAFFOLD).not.toContain("borderTopWidth");
    expect(PRODUCT_FORM).toContain("EditorFooter");
    expect(PRODUCT_FORM).not.toContain("borderTopWidth");
    expect(PRODUCT_DETAIL).toContain("EditorFooter");
    expect(PRODUCT_DETAIL).not.toContain("borderTopWidth");
    expect(ORDER_FORM).toContain("EditorFooter");
    expect(ORDER_FORM).not.toContain("footerDock");
    expect(ORDER_FORM).not.toContain("До сплати");
  });
});
