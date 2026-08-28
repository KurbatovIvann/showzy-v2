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
import {
  companyCustomers,
  counterparties,
  customerGroups,
} from "@showzy/db/schema/customers";
import { priceLists } from "@showzy/db/schema/pricing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getCustomer } from "./get-customer.js";

const fixtures = {
  customerA: randomUUID(),
  customerAEmpty: randomUUID(),
  customerArchived: randomUUID(),
  customerB: randomUUID(),
  groupA: randomUUID(),
  listA: randomUUID(),
  partyA: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();

  await kit.db.runtime.db.insert(priceLists).values({
    id: fixtures.listA,
    companyId: kitIdentities.companies.a,
    name: "Wholesale A",
  });

  await kit.db.runtime.db.insert(customerGroups).values({
    id: fixtures.groupA,
    companyId: kitIdentities.companies.a,
    name: "Alpha",
    slug: "alpha",
  });

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.customerA,
      companyId: kitIdentities.companies.a,
      name: "Alpha Cake",
      phone: "+380501111111",
      email: "alpha@kit.test",
      notes: "VIP baker",
      groupId: fixtures.groupA,
      priceListId: fixtures.listA,
    },
    {
      id: fixtures.customerAEmpty,
      companyId: kitIdentities.companies.a,
      name: "Bare",
      email: "bare@kit.test",
    },
    {
      id: fixtures.customerArchived,
      companyId: kitIdentities.companies.a,
      name: "Old Thing",
      phone: "+380501000099",
      status: "archived",
    },
    {
      id: fixtures.customerB,
      companyId: kitIdentities.companies.b,
      name: "Bravo",
      email: "bravo@kit.test",
    },
  ]);

  await kit.db.runtime.db.insert(counterparties).values({
    id: fixtures.partyA,
    companyId: kitIdentities.companies.a,
    customerId: fixtures.customerA,
    name: "ТОВ Партнер",
  });

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-get-customer.test",
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
      getCustomer,
      { input: { id: fixtures.customerA } },
      { input: { id: fixtures.customerB } },
    ),
  ],
);

describe("customers.getCustomer", () => {
  it("returns the customer view including status and linked counterparties", async () => {
    const result = await kit.invoke(getCustomer, { id: fixtures.customerA });

    expect(result).toMatchObject({
      id: fixtures.customerA,
      name: "Alpha Cake",
      phone: "+380501111111",
      email: "alpha@kit.test",
      userId: null,
      notes: "VIP baker",
      groupId: fixtures.groupA,
      priceListId: fixtures.listA,
      status: "active",
      linkedCounterpartyCount: 1,
    });
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("returns a customer with no counterparties as linkedCounterpartyCount 0", async () => {
    const result = await kit.invoke(getCustomer, {
      id: fixtures.customerAEmpty,
    });
    expect(result).toMatchObject({
      id: fixtures.customerAEmpty,
      name: "Bare",
      phone: null,
      email: "bare@kit.test",
      notes: null,
      groupId: null,
      priceListId: null,
      status: "active",
      linkedCounterpartyCount: 0,
    });
  });

  it("returns an archived customer without restoring", async () => {
    const result = await kit.invoke(getCustomer, {
      id: fixtures.customerArchived,
    });
    expect(result).toMatchObject({
      id: fixtures.customerArchived,
      name: "Old Thing",
      status: "archived",
      linkedCounterpartyCount: 0,
    });
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        getCustomer,
        { id: fixtures.customerA },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a malformed customer id", async () => {
    await expect(
      kit.invoke(getCustomer, { id: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails missing and foreign customers with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit.invoke(getCustomer, { id: missingId }).then(
      () => {
        throw new Error("expected NotFoundError for a missing customer");
      },
      (error: unknown) => error,
    );
    const foreignError = await kit
      .invoke(getCustomer, { id: fixtures.customerB })
      .then(
        () => {
          throw new Error("expected NotFoundError for a foreign customer");
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
