import { describe, expect, it } from "vitest";

import {
  counterpartyCreateHref,
  counterpartyEditorHref,
  customerCreateHref,
  customerEditorHref,
  groupCreateHref,
  groupEditorHref,
} from "./customer-hrefs";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

describe("customer hrefs", () => {
  it("keeps create/edit under /customers/clients, /groups, and /counterparties", () => {
    expect(customerCreateHref()).toBe("/customers/clients/new");
    expect(customerEditorHref(CUSTOMER_ID)).toBe(
      `/customers/clients/${CUSTOMER_ID}/edit`,
    );
    expect(groupCreateHref()).toBe("/customers/groups/new");
    expect(groupEditorHref(GROUP_ID)).toBe(
      `/customers/groups/${GROUP_ID}/edit`,
    );
    expect(counterpartyCreateHref()).toBe("/customers/counterparties/new");
    expect(counterpartyEditorHref(COUNTERPARTY_ID)).toBe(
      `/customers/counterparties/${COUNTERPARTY_ID}/edit`,
    );
  });
});
