import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./option-select-sheet.tsx", import.meta.url),
  "utf8",
);

const CUSTOMER_FORM_VIEWS = [
  "../../features/customers/form/customer-form-view.tsx",
  "../../features/customers/groups/group-form-view.tsx",
  "../../features/customers/counterparties/counterparty-form-view.tsx",
  "../../features/customers/invitations/invitation-form-view.tsx",
] as const;

describe("OptionSelectSheet prop union", () => {
  it("declares every former feature delta as an optional prop", () => {
    expect(SOURCE).toContain("readonly emptyOptionLabel?:");
    expect(SOURCE).toContain("readonly emptyLabel?:");
    expect(SOURCE).toContain("readonly searchMaxLength?:");
    expect(SOURCE).toContain("readonly selectedIds?:");
    expect(SOURCE).toContain('readonly leading?: "user"');
    expect(SOURCE).toContain("onChange: (value: string | null) => void");
  });

  it("keeps the documents/orders checkmark, avatar, selectedIds, and empty state", () => {
    expect(SOURCE).toContain("styles.check");
    expect(SOURCE).toContain("theme.colors.primaryForeground");
    expect(SOURCE).toContain('props.leading === "user"');
    expect(SOURCE).toContain("UserIcon");
    expect(SOURCE).toContain("props.selectedIds.has(option.id)");
    expect(SOURCE).toContain("styles.empty");
    expect(SOURCE).toContain("{emptyLabel}</Text>");
  });

  it("includes description in the row a11y label", () => {
    expect(SOURCE).toContain("`${props.label}, ${description}` : props.label");
    expect(SOURCE).toContain(
      "accessibilityState={{ selected: props.selected }}",
    );
  });

  it("always passes closeAccessibilityLabel into Sheet", () => {
    expect(SOURCE).toContain("closeAccessibilityLabel={props.closeLabel}");
  });
});

describe("customers picker empty-state backport", () => {
  it("passes emptyLabel at every customers OptionSelectSheet (owner decision 3)", () => {
    for (const relative of CUSTOMER_FORM_VIEWS) {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      const sheets = source.match(/<OptionSelectSheet\b[\s\S]*?\/>/g) ?? [];
      expect(sheets.length).toBeGreaterThan(0);
      for (const sheet of sheets) {
        expect(sheet).toContain("emptyLabel=");
      }
    }
  });
});
