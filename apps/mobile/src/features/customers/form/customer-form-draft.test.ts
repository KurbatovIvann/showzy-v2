import { describe, expect, it } from "vitest";

import type { GetCustomerOutput } from "../api/customer-detail-query";
import {
  draftFromCustomer,
  emptyCustomerFormDraft,
  isCustomerFormDirty,
  parseCustomerFormUiDraft,
  snapshotFromCustomer,
  snapshotFromDraft,
  validateCustomerForm,
  type CustomerFormDraft,
} from "./customer-form-draft";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";

const loaded: GetCustomerOutput = {
  id: CUSTOMER_ID,
  name: "Марія Ткаченко",
  phone: "+380670000000",
  email: "maria@example.com",
  userId: null,
  notes: "Алергія на горіхи",
  groupId: GROUP_ID,
  priceListId: PRICE_LIST_ID,
  status: "active",
  linkedCounterpartyCount: 0,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

function validCreateDraft(): CustomerFormDraft {
  return {
    ...emptyCustomerFormDraft(),
    name: "  Марія  ",
    phone: " +38067 ",
  };
}

describe("draftFromCustomer / snapshotFromCustomer", () => {
  it("prefills text fields and keeps assignment ids", () => {
    expect(draftFromCustomer(loaded)).toEqual({
      name: "Марія Ткаченко",
      phone: "+380670000000",
      email: "maria@example.com",
      notes: "Алергія на горіхи",
      groupId: GROUP_ID,
      priceListId: PRICE_LIST_ID,
      userId: null,
    });
    expect(snapshotFromCustomer(loaded).name).toBe("Марія Ткаченко");
    expect(snapshotFromCustomer(loaded).groupId).toBe(GROUP_ID);
  });

  it("keeps a userId-only row so the form can save without an account picker", () => {
    const userOnly: GetCustomerOutput = {
      ...loaded,
      phone: null,
      email: null,
      userId: "user_invite",
    };
    const draft = draftFromCustomer(userOnly);
    expect(draft.userId).toBe("user_invite");
    expect(validateCustomerForm(draft).contact).toBeNull();
    expect(parseCustomerFormUiDraft(draft).ok).toBe(true);
  });
});

describe("isCustomerFormDirty", () => {
  it("is clean against the origin and dirty after a field or assignment change", () => {
    const origin = draftFromCustomer(loaded);
    expect(isCustomerFormDirty(origin, origin)).toBe(false);
    expect(isCustomerFormDirty({ ...origin, name: "Інша" }, origin)).toBe(true);
    expect(isCustomerFormDirty({ ...origin, groupId: null }, origin)).toBe(
      true,
    );
    expect(isCustomerFormDirty({ ...origin, priceListId: null }, origin)).toBe(
      true,
    );
  });
});

describe("snapshotFromDraft", () => {
  it("trims name and turns blank contacts into null inherit assignments", () => {
    expect(snapshotFromDraft(validCreateDraft())).toEqual({
      name: "Марія",
      phone: "+38067",
      email: null,
      notes: null,
      groupId: null,
      priceListId: null,
      userId: null,
    });
    expect(snapshotFromDraft(emptyCustomerFormDraft())).toBeNull();
  });
});
