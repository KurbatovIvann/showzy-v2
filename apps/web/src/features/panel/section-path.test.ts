import { describe, expect, it } from "vitest";

import {
  isFullShellPath,
  isSectionDetailPath,
  listPathForPathname,
  panelSectionFromPathname,
} from "./section-path";

const SLUG = "kviti-lviv";

describe("panelSectionFromPathname", () => {
  it("treats the company index as orders and follows nested tabs", () => {
    expect(panelSectionFromPathname(`/${SLUG}`, SLUG)).toBe("orders");
    expect(panelSectionFromPathname(`/${SLUG}/`, SLUG)).toBe("orders");
    expect(panelSectionFromPathname(`/${SLUG}/orders`, SLUG)).toBe("orders");
    expect(panelSectionFromPathname(`/${SLUG}/orders/new`, SLUG)).toBe("orders");
    expect(
      panelSectionFromPathname(`/${SLUG}/documents/templates/t1/edit`, SLUG),
    ).toBe("documents");
    expect(panelSectionFromPathname(`/${SLUG}/customers/groups`, SLUG)).toBe(
      "customer-groups",
    );
    expect(
      panelSectionFromPathname(`/${SLUG}/customers/counterparties/c1`, SLUG),
    ).toBe("counterparties");
    expect(panelSectionFromPathname(`/${SLUG}/company/legal`, SLUG)).toBe(
      "company",
    );
  });
});

describe("isSectionDetailPath", () => {
  it("uses route depth so phone can XOR list and detail", () => {
    expect(isSectionDetailPath(`/${SLUG}`, SLUG)).toBe(false);
    expect(isSectionDetailPath(`/${SLUG}/orders`, SLUG)).toBe(false);
    expect(isSectionDetailPath(`/${SLUG}/orders/abc`, SLUG)).toBe(true);
    expect(isSectionDetailPath(`/${SLUG}/documents/templates`, SLUG)).toBe(
      false,
    );
    expect(isSectionDetailPath(`/${SLUG}/documents/templates/t1`, SLUG)).toBe(
      true,
    );
    expect(isSectionDetailPath(`/${SLUG}/company`, SLUG)).toBe(false);
    expect(isSectionDetailPath(`/${SLUG}/company/team`, SLUG)).toBe(true);
  });
});

describe("isFullShellPath", () => {
  it("detects the template editor takeover", () => {
    expect(isFullShellPath(`/${SLUG}/documents/templates/t1/edit`, SLUG)).toBe(
      true,
    );
    expect(isFullShellPath(`/${SLUG}/documents/templates/t1`, SLUG)).toBe(
      false,
    );
  });
});

describe("listPathForPathname", () => {
  it("returns the section list route for back navigation", () => {
    expect(listPathForPathname(`/${SLUG}/orders/abc`, SLUG)).toBe(
      "/$companySlug/orders",
    );
    expect(listPathForPathname(`/${SLUG}/documents/templates/t1`, SLUG)).toBe(
      "/$companySlug/documents/templates",
    );
    expect(listPathForPathname(`/${SLUG}/company/legal`, SLUG)).toBe(
      "/$companySlug/company",
    );
  });
});
