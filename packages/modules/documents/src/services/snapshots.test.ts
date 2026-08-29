import { ValidationError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  COUNTERPARTY_CUSTOMER_MISMATCH_MESSAGE,
  MISSING_BUYER_MESSAGE,
  MISSING_SELLER_LEGAL_MESSAGE,
  requireCounterpartyCustomerMatch,
  requireOrderCustomerId,
  requireSellerLegal,
  snapshotCustomerBuyer,
  snapshotSupplier,
} from "./snapshots.js";

const legal = {
  companyType: "tov",
  legalName: "ТОВ Альфа",
  edrpou: "12345678",
  legalAddress: "вул. Хрещатик, 1",
  iban: "UA123456789012345678901234567",
  bankName: "ПриватБанк",
  bankMfo: "300001",
  bankEdrpou: "12345678",
  phone: "+380501111111",
  email: "legal@alpha.test",
};

describe("document snapshots", () => {
  it("requires seller legal and snapshots the seller face with prefix", () => {
    expect(() => requireSellerLegal(null)).toThrow(ValidationError);
    try {
      requireSellerLegal(null);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.clientMessage).toBe(MISSING_SELLER_LEGAL_MESSAGE);
      }
    }
    expect(
      snapshotSupplier({
        name: "Konditerska Anna",
        prefix: "KA",
        legal,
      }),
    ).toMatchObject({
      kind: "seller",
      name: "Konditerska Anna",
      prefix: "KA",
      companyType: "tov",
      legalName: "ТОВ Альфа",
    });
  });

  it("requires an order customer when no counterparty is supplied", () => {
    expect(() => requireOrderCustomerId(null)).toThrow(ValidationError);
    try {
      requireOrderCustomerId(null);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.clientMessage).toBe(MISSING_BUYER_MESSAGE);
      }
    }
    expect(requireOrderCustomerId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });

  it("rejects a counterparty linked to a different customer and allows standalone", () => {
    const orderCustomer = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(() => {
      requireCounterpartyCustomerMatch(other, orderCustomer);
    }).toThrow(ValidationError);
    try {
      requireCounterpartyCustomerMatch(other, orderCustomer);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.clientMessage).toBe(
          COUNTERPARTY_CUSTOMER_MISMATCH_MESSAGE,
        );
      }
    }
    expect(() => {
      requireCounterpartyCustomerMatch(null, orderCustomer);
    }).not.toThrow();
    expect(() => {
      requireCounterpartyCustomerMatch(orderCustomer, orderCustomer);
    }).not.toThrow();
    expect(snapshotCustomerBuyer("Customer A")).toEqual({
      kind: "customer",
      displayName: "Customer A",
    });
  });
});
