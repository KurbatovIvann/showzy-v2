import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./selector-row.tsx", import.meta.url),
  "utf8",
);

const FEATURE_VIEWS = [
  "../../features/customers/form/customer-form-view.tsx",
  "../../features/customers/groups/group-form-view.tsx",
  "../../features/customers/counterparties/counterparty-form-view.tsx",
  "../../features/customers/invitations/invitation-form-view.tsx",
  "../../features/documents/form/document-form-view.tsx",
  "../../features/orders/form/order-form-view.tsx",
] as const;

describe("SelectorRow prop union", () => {
  it("declares subtitle and the customers changed pill as optional props", () => {
    expect(SOURCE).toContain("readonly subtitle?:");
    expect(SOURCE).toContain("readonly changed?:");
    expect(SOURCE).toContain("readonly changedLabel?:");
    expect(SOURCE).toContain("StatusPill");
    expect(SOURCE).toContain('tone="action"');
    expect(SOURCE).toContain("styles.subtitle");
  });

  it("builds a11y as label: value, or label: value, subtitle when set", () => {
    expect(SOURCE).toContain("`${value}, ${subtitle}`");
    expect(SOURCE).toContain(
      "accessibilityLabel={`${props.label}: ${a11yValue}`}",
    );
  });
});

describe("SelectorRow a11y label parity at feature call sites", () => {
  it("documents and orders pass subtitle; customers pass the changed pill", () => {
    const documents = readFileSync(
      new URL(
        "../../features/documents/form/document-form-view.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const orders = readFileSync(
      new URL(
        "../../features/orders/form/order-form-view.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const customers = readFileSync(
      new URL(
        "../../features/customers/form/customer-form-view.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(documents).toContain("subtitle={model.orderSubtitle}");
    expect(orders).toContain("subtitle={model.customerPhone}");
    expect(customers).toContain("changed={model.groupChanged}");
    expect(customers).toContain("changedLabel={form.changedLabel}");
  });

  it("keeps the shared SelectorRow import and does not fork local copies", () => {
    for (const relative of FEATURE_VIEWS) {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      expect(source).toContain("SelectorRow");
      expect(source).toContain('from "../../../components/ui"');
      expect(source).not.toContain("./selector-row");
      expect(source).not.toContain("../shared/selector-row");
    }
  });
});
