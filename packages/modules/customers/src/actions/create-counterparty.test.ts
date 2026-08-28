import { describe, expect, it } from "vitest";

import {
  COUNTERPARTY_BANK_MFO_MAX,
  COUNTERPARTY_BANK_NAME_MAX,
  COUNTERPARTY_EDRPOU_MAX,
  COUNTERPARTY_EMAIL_MAX,
  COUNTERPARTY_IBAN_MAX,
  COUNTERPARTY_LEGAL_ADDRESS_MAX,
  COUNTERPARTY_NAME_MAX,
  COUNTERPARTY_NOTES_MAX,
  COUNTERPARTY_PHONE_MAX,
  createCounterpartyContract,
  createCounterpartyInputSchema,
  createCounterpartyOutputSchema,
} from "./create-counterparty.contract.js";

describe("customers.createCounterparty contract", () => {
  it("is an idempotent audited staff client write with customers:edit and no events", () => {
    expect(createCounterpartyContract.name).toBe(
      "customers.createCounterparty",
    );
    expect(createCounterpartyContract.principal).toBe("staff");
    expect(createCounterpartyContract.transport).toBe("client");
    expect(createCounterpartyContract.risk).toBe("write");
    expect(createCounterpartyContract.permissions).toEqual(["customers:edit"]);
    expect(createCounterpartyContract.aiExposure).toBe("exposed");
    expect(createCounterpartyContract.requiresConfirmation).toBe(false);
    expect(createCounterpartyContract.idempotent).toBe(true);
    expect(createCounterpartyContract.audit).toBe(true);
    expect(createCounterpartyContract.emits).toEqual([]);
    expect(createCounterpartyContract.atomicCalls).toEqual([]);
    expect(createCounterpartyContract.atomicCallers).toEqual([]);
    expect(createCounterpartyContract.timeout).toBe(5_000);
    expect(createCounterpartyContract.rateLimit).toBeUndefined();
    expect(COUNTERPARTY_NAME_MAX).toBe(300);
    expect(COUNTERPARTY_EDRPOU_MAX).toBe(10);
    expect(COUNTERPARTY_LEGAL_ADDRESS_MAX).toBe(500);
    expect(COUNTERPARTY_IBAN_MAX).toBe(34);
    expect(COUNTERPARTY_BANK_NAME_MAX).toBe(200);
    expect(COUNTERPARTY_BANK_MFO_MAX).toBe(6);
    expect(COUNTERPARTY_PHONE_MAX).toBe(30);
    expect(COUNTERPARTY_EMAIL_MAX).toBe(200);
    expect(COUNTERPARTY_NOTES_MAX).toBe(2000);
  });

  it("trims the name and defaults omitted optional fields", () => {
    const parsed = createCounterpartyInputSchema.parse({
      name: "  ТОВ Київські торти  ",
    });
    expect(parsed).toEqual({ name: "ТОВ Київські торти" });
    expect(
      Object.keys(createCounterpartyOutputSchema.shape).toSorted(),
    ).toEqual([
      "bankMfo",
      "bankName",
      "createdAt",
      "customerId",
      "customerName",
      "edrpou",
      "email",
      "iban",
      "id",
      "legalAddress",
      "name",
      "notes",
      "phone",
      "updatedAt",
    ]);
  });

  it("trims optional requisites and accepts null customerId", () => {
    expect(
      createCounterpartyInputSchema.parse({
        name: "ТОВ Партнер",
        edrpou: "  12345678  ",
        legalAddress: "  вул. Хрещатик, 1  ",
        iban: "  UA123  ",
        bankName: "  ПриватБанк  ",
        bankMfo: "  300001  ",
        phone: "  +380501112233  ",
        email: "  office@kit.test  ",
        notes: "  keep  ",
        customerId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      name: "ТОВ Партнер",
      edrpou: "12345678",
      legalAddress: "вул. Хрещатик, 1",
      iban: "UA123",
      bankName: "ПриватБанк",
      bankMfo: "300001",
      phone: "+380501112233",
      email: "office@kit.test",
      notes: "keep",
      customerId: "11111111-1111-4111-8111-111111111111",
    });
    expect(
      createCounterpartyInputSchema.parse({
        name: "Standalone",
        customerId: null,
        edrpou: null,
      }),
    ).toMatchObject({
      customerId: null,
      edrpou: null,
    });
  });

  it("rejects blank names, over-max fields, and malformed customer ids", () => {
    expect(
      createCounterpartyInputSchema.safeParse({ name: "   " }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "x".repeat(COUNTERPARTY_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        edrpou: "1".repeat(COUNTERPARTY_EDRPOU_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        legalAddress: "x".repeat(COUNTERPARTY_LEGAL_ADDRESS_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        iban: "x".repeat(COUNTERPARTY_IBAN_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        bankName: "x".repeat(COUNTERPARTY_BANK_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        bankMfo: "1".repeat(COUNTERPARTY_BANK_MFO_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        phone: "1".repeat(COUNTERPARTY_PHONE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        email: "x".repeat(COUNTERPARTY_EMAIL_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        notes: "x".repeat(COUNTERPARTY_NOTES_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.safeParse({
        name: "ТОВ",
        customerId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      createCounterpartyInputSchema.parse({
        name: "ТОВ",
        email: "not-an-email",
      }).email,
    ).toBe("not-an-email");
  });

  it("rejects identifier fields — the input is strict", () => {
    const valid = { name: "ТОВ Партнер" };
    for (const extra of [
      { companyId: "c" },
      { id: "11111111-1111-4111-8111-111111111111" },
      { groupId: "11111111-1111-4111-8111-111111111111" },
      { priceListId: "11111111-1111-4111-8111-111111111111" },
      { userId: "u" },
      { kind: "business" },
      { archived: true },
      { status: "archived" },
    ]) {
      expect(
        createCounterpartyInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });
});
