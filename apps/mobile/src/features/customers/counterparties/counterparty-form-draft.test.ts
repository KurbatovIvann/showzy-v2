import { describe, expect, it } from "vitest";

import type { GetCounterpartyOutput } from "../api/counterparty-detail-query";
import {
  draftFromCounterparty,
  emptyCounterpartyFormDraft,
  isCounterpartyFormDirty,
  parseCounterpartyFormUiDraft,
  snapshotFromCounterparty,
  snapshotFromDraft,
  type CounterpartyFormDraft,
} from "./counterparty-form-draft";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const SAMPLE_UA_IBAN = "UA000000000000000000000000000";

const loaded: GetCounterpartyOutput = {
  id: COUNTERPARTY_ID,
  name: "ФОП Іваненко О. П.",
  edrpou: "3312456789",
  legalAddress: "м. Київ, вул. Володимирська, 12",
  iban: SAMPLE_UA_IBAN,
  bankName: "АТ КБ «ПриватБанк»",
  bankMfo: "322313",
  phone: "+380670000000",
  email: "office@example.com",
  notes: "Умови оплати",
  customerId: CUSTOMER_ID,
  customerName: "Марія",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

function validCreateDraft(): CounterpartyFormDraft {
  return {
    ...emptyCounterpartyFormDraft(),
    name: "  ФОП Іваненко  ",
  };
}

describe("draftFromCounterparty / snapshotFromCounterparty", () => {
  it("prefills text fields and keeps the customer link", () => {
    expect(draftFromCounterparty(loaded)).toEqual({
      name: "ФОП Іваненко О. П.",
      edrpou: "3312456789",
      legalAddress: "м. Київ, вул. Володимирська, 12",
      iban: SAMPLE_UA_IBAN,
      bankName: "АТ КБ «ПриватБанк»",
      bankMfo: "322313",
      phone: "+380670000000",
      email: "office@example.com",
      notes: "Умови оплати",
      customerId: CUSTOMER_ID,
    });
    expect(snapshotFromCounterparty(loaded).customerId).toBe(CUSTOMER_ID);
    expect(snapshotFromCounterparty(loaded).iban).toBe(SAMPLE_UA_IBAN);
  });

  it("prefills a standalone row with a null customer id", () => {
    const standalone: GetCounterpartyOutput = {
      ...loaded,
      customerId: null,
      customerName: null,
    };
    expect(draftFromCounterparty(standalone).customerId).toBeNull();
  });
});

describe("isCounterpartyFormDirty", () => {
  it("is clean against the origin and dirty after unlink", () => {
    const origin = draftFromCounterparty(loaded);
    expect(isCounterpartyFormDirty(origin, origin)).toBe(false);
    expect(isCounterpartyFormDirty({ ...origin, name: "Інша" }, origin)).toBe(
      true,
    );
    expect(
      isCounterpartyFormDirty({ ...origin, customerId: null }, origin),
    ).toBe(true);
  });
});

describe("snapshotFromDraft", () => {
  it("trims name and turns blank optionals into null", () => {
    expect(snapshotFromDraft(validCreateDraft())).toEqual({
      name: "ФОП Іваненко",
      edrpou: null,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      phone: null,
      email: null,
      notes: null,
      customerId: null,
    });
    expect(snapshotFromDraft(emptyCounterpartyFormDraft())).toBeNull();
    expect(emptyCounterpartyFormDraft(CUSTOMER_ID).customerId).toBe(
      CUSTOMER_ID,
    );
    expect(parseCounterpartyFormUiDraft(validCreateDraft()).ok).toBe(true);
  });
});
