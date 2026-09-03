import { describe, expect, it } from "vitest";

import { assistantCopy } from "../../../i18n/assistant";
import { assistantJobLabel } from "./job-labels";

const uk = assistantCopy("uk");
const en = assistantCopy("en");

describe("assistantJobLabel", () => {
  it("uses Ukrainian job copy, not the orders_list_page wire name", () => {
    const label = assistantJobLabel("orders_list_page", uk);
    expect(label).toBe("Шукаю замовлення");
    expect(label).not.toBe("orders_list_page");
    expect(label.includes("orders_list_page")).toBe(false);
  });

  it("uses Ukrainian job copy, not the orders_list_counts wire name", () => {
    const label = assistantJobLabel("orders_list_counts", uk);
    expect(label).toBe("Рахую виторг");
    expect(label.includes("orders_list_counts")).toBe(false);
  });

  it("maps dotted orders.get to the same label as orders_get", () => {
    expect(assistantJobLabel("orders.get", uk)).toBe(uk.jobs.orders_get);
    expect(assistantJobLabel("orders_get", en)).toBe(en.jobs.orders_get);
  });

  it("falls back without echoing an unknown wire name", () => {
    const label = assistantJobLabel("customers.deleteCustomer", uk);
    expect(label).toBe("Працюю");
    expect(label.includes("customers.deleteCustomer")).toBe(false);
    expect(label.includes("customers_deleteCustomer")).toBe(false);
  });
});
