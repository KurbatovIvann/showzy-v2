import { describe, expect, it } from "vitest";

import {
  CONTACT_REQUIRED_MESSAGE,
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  CUSTOMER_USER_ID_MAX,
  customerViewSchema,
} from "./customer-view.contract.js";
import {
  createCustomerContract,
  createCustomerInputSchema,
} from "./create-customer.contract.js";

describe("customers.createCustomer contract", () => {
  it("is an idempotent audited staff client write with customers:create and no events", () => {
    expect(createCustomerContract.name).toBe("customers.createCustomer");
    expect(createCustomerContract.principal).toBe("staff");
    expect(createCustomerContract.transport).toBe("client");
    expect(createCustomerContract.risk).toBe("write");
    expect(createCustomerContract.permissions).toEqual(["customers:create"]);
    expect(createCustomerContract.aiExposure).toBe("exposed");
    expect(createCustomerContract.requiresConfirmation).toBe(false);
    expect(createCustomerContract.idempotent).toBe(true);
    expect(createCustomerContract.audit).toBe(true);
    expect(createCustomerContract.emits).toEqual([]);
    expect(createCustomerContract.atomicCalls).toEqual([]);
    expect(createCustomerContract.atomicCallers).toEqual([]);
    expect(createCustomerContract.timeout).toBe(10_000);
    expect(createCustomerContract.rateLimit).toBeUndefined();
    expect(CUSTOMER_NAME_MAX).toBe(120);
    expect(CUSTOMER_PHONE_MAX).toBe(30);
    expect(CUSTOMER_EMAIL_MAX).toBe(200);
    expect(CUSTOMER_NOTES_MAX).toBe(2000);
    expect(CUSTOMER_USER_ID_MAX).toBe(128);
    expect(Object.keys(customerViewSchema.shape).toSorted()).toEqual([
      "createdAt",
      "email",
      "groupId",
      "id",
      "linkedCounterpartyCount",
      "name",
      "notes",
      "phone",
      "priceListId",
      "status",
      "updatedAt",
      "userId",
    ]);
  });

  it("trims the name and accepts each single contact channel", () => {
    expect(
      createCustomerInputSchema.parse({
        name: "  Марія  ",
        phone: "  +380501112233  ",
      }),
    ).toEqual({
      name: "Марія",
      phone: "+380501112233",
    });
    expect(
      createCustomerInputSchema.parse({
        name: "Mail",
        email: "  a@b.co  ",
      }).email,
    ).toBe("a@b.co");
    expect(
      createCustomerInputSchema.parse({
        name: "Linked",
        userId: "  user_abc  ",
      }).userId,
    ).toBe("user_abc");
    expect(
      createCustomerInputSchema.parse({
        name: "Blank phone",
        phone: "   ",
        email: "a@b.co",
      }),
    ).toEqual({
      name: "Blank phone",
      phone: "",
      email: "a@b.co",
    });
  });

  it("rejects blank names, missing contacts, over-max lengths, and identifier extras", () => {
    expect(
      createCustomerInputSchema.safeParse({ name: "   ", phone: "1" }).success,
    ).toBe(false);
    expect(
      createCustomerInputSchema.safeParse({
        name: "x".repeat(CUSTOMER_NAME_MAX + 1),
        phone: "1",
      }).success,
    ).toBe(false);
    const missingContacts = createCustomerInputSchema.safeParse({
      name: "No contact",
    });
    expect(missingContacts.success).toBe(false);
    if (!missingContacts.success) {
      expect(
        missingContacts.error.issues.some(
          (issue) => issue.message === CONTACT_REQUIRED_MESSAGE,
        ),
      ).toBe(true);
    }
    expect(
      createCustomerInputSchema.safeParse({
        name: "Long phone",
        phone: "1".repeat(CUSTOMER_PHONE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCustomerInputSchema.safeParse({
        name: "Long email",
        email: `${"a".repeat(CUSTOMER_EMAIL_MAX)}@x.co`,
      }).success,
    ).toBe(false);
    expect(
      createCustomerInputSchema.safeParse({
        name: "Long notes",
        phone: "1",
        notes: "n".repeat(CUSTOMER_NOTES_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createCustomerInputSchema.safeParse({
        name: "Long user",
        userId: "u".repeat(CUSTOMER_USER_ID_MAX + 1),
      }).success,
    ).toBe(false);
    const valid = { name: "Cake", phone: "1" };
    for (const extra of [
      { companyId: "c" },
      { id: "11111111-1111-4111-8111-111111111111" },
      { status: "archived" },
    ]) {
      expect(
        createCustomerInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });
});
