import { randomUUID } from "node:crypto";

import {
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from "@showzy/core/errors";
import {
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { user } from "@showzy/db/schema/auth";
import { companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getCounterparty } from "./get-counterparty.js";

const fixtures = {
  customerA: randomUUID(),
  customerAArchived: randomUUID(),
  customerB: randomUUID(),
  partyLinked: randomUUID(),
  partyStandalone: randomUUID(),
  partyArchivedLink: randomUUID(),
  partyB: randomUUID(),
};

const clerkUserId = randomUUID();
const sampleEdrpou = "12345678";
const fixtureIban = "UA123456789012345678901234567";

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.customerA,
      companyId: kitIdentities.companies.a,
      name: "Alpha Cake",
      phone: "+380501111111",
    },
    {
      id: fixtures.customerAArchived,
      companyId: kitIdentities.companies.a,
      name: "Archived Baker",
      email: "archived@kit.test",
      status: "archived",
    },
    {
      id: fixtures.customerB,
      companyId: kitIdentities.companies.b,
      name: "Bravo Cake",
      email: "bravo@kit.test",
    },
  ]);

  await kit.db.runtime.db.insert(counterparties).values([
    {
      id: fixtures.partyLinked,
      companyId: kitIdentities.companies.a,
      customerId: fixtures.customerA,
      name: "ТОВ Альфа",
      edrpou: sampleEdrpou,
      legalAddress: "вул. Хрещатик, 1",
      iban: fixtureIban,
      bankName: "ПриватБанк",
      bankMfo: "300001",
      phone: "+380501111111",
      email: "legal@alpha.test",
      notes: "Linked legal face",
    },
    {
      id: fixtures.partyStandalone,
      companyId: kitIdentities.companies.a,
      name: "ТОВ Самостійна",
    },
    {
      id: fixtures.partyArchivedLink,
      companyId: kitIdentities.companies.a,
      customerId: fixtures.customerAArchived,
      name: "ТОВ Архів",
    },
    {
      id: fixtures.partyB,
      companyId: kitIdentities.companies.b,
      customerId: fixtures.customerB,
      name: "ТОВ Браво",
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-get-counterparty.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: kitIdentities.companies.a,
    userId: clerkUserId,
    role: "employee",
    permissions: { granted: [], denied: ["customers:view"] },
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      getCounterparty,
      { input: { id: fixtures.partyLinked } },
      { input: { id: fixtures.partyB } },
    ),
  ],
);

describe("customers.getCounterparty", () => {
  it("returns the shared counterparty view including the live customer name", async () => {
    const result = await kit.invoke(getCounterparty, {
      id: fixtures.partyLinked,
    });

    expect(result).toMatchObject({
      id: fixtures.partyLinked,
      name: "ТОВ Альфа",
      edrpou: sampleEdrpou,
      legalAddress: "вул. Хрещатик, 1",
      iban: fixtureIban,
      bankName: "ПриватБанк",
      bankMfo: "300001",
      phone: "+380501111111",
      email: "legal@alpha.test",
      notes: "Linked legal face",
      customerId: fixtures.customerA,
      customerName: "Alpha Cake",
    });
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("returns a standalone counterparty with null customer fields", async () => {
    const result = await kit.invoke(getCounterparty, {
      id: fixtures.partyStandalone,
    });
    expect(result).toMatchObject({
      id: fixtures.partyStandalone,
      name: "ТОВ Самостійна",
      edrpou: null,
      iban: null,
      customerId: null,
      customerName: null,
    });
  });

  it("returns the live name of an archived linked customer", async () => {
    const result = await kit.invoke(getCounterparty, {
      id: fixtures.partyArchivedLink,
    });
    expect(result).toMatchObject({
      id: fixtures.partyArchivedLink,
      customerId: fixtures.customerAArchived,
      customerName: "Archived Baker",
    });
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        getCounterparty,
        { id: fixtures.partyLinked },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a malformed counterparty id", async () => {
    await expect(
      kit.invoke(getCounterparty, { id: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails missing and foreign counterparties with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit
      .invoke(getCounterparty, { id: missingId })
      .then(
        () => {
          throw new Error("expected NotFoundError for a missing counterparty");
        },
        (error: unknown) => error,
      );
    const foreignError = await kit
      .invoke(getCounterparty, { id: fixtures.partyB })
      .then(
        () => {
          throw new Error("expected NotFoundError for a foreign counterparty");
        },
        (error: unknown) => error,
      );

    expect(missingError).toBeInstanceOf(NotFoundError);
    expect(foreignError).toBeInstanceOf(NotFoundError);
    if (
      missingError instanceof NotFoundError &&
      foreignError instanceof NotFoundError
    ) {
      expect(missingError.clientMessage).toBe(foreignError.clientMessage);
    }
  });
});
