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
import { companyCustomers, customerGroups } from "@showzy/db/schema/customers";
import { priceLists } from "@showzy/db/schema/pricing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getCustomerPricingFacts } from "./get-customer-pricing-facts.js";

const fixtures = {
  customerAAssigned: randomUUID(),
  customerABare: randomUUID(),
  customerAGroupOnly: randomUUID(),
  customerB: randomUUID(),
  groupA: randomUUID(),
  groupAEmpty: randomUUID(),
  listACustomer: randomUUID(),
  listAGroup: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

async function insertPriceList(values: {
  id: string;
  companyId: string;
}): Promise<void> {
  await kit.db.runtime.db.insert(priceLists).values({
    id: values.id,
    companyId: values.companyId,
    name: "Price list",
  });
}

async function insertGroup(values: {
  id: string;
  companyId: string;
  priceListId?: string;
}): Promise<void> {
  await kit.db.runtime.db.insert(customerGroups).values({
    id: values.id,
    companyId: values.companyId,
    name: `Group ${values.id}`,
    slug: `group-${values.id}`,
    ...(values.priceListId === undefined
      ? {}
      : { priceListId: values.priceListId }),
  });
}

async function insertCustomer(values: {
  id: string;
  companyId: string;
  groupId?: string;
  priceListId?: string;
}): Promise<void> {
  await kit.db.runtime.db.insert(companyCustomers).values({
    id: values.id,
    companyId: values.companyId,
    name: `Customer ${values.id}`,
    email: `customer-${values.id}@example.com`,
    ...(values.groupId === undefined ? {} : { groupId: values.groupId }),
    ...(values.priceListId === undefined
      ? {}
      : { priceListId: values.priceListId }),
  });
}

beforeAll(async () => {
  kit = await createTestKit();

  await insertPriceList({
    id: fixtures.listACustomer,
    companyId: kitIdentities.companies.a,
  });
  await insertPriceList({
    id: fixtures.listAGroup,
    companyId: kitIdentities.companies.a,
  });

  await insertGroup({
    id: fixtures.groupA,
    companyId: kitIdentities.companies.a,
    priceListId: fixtures.listAGroup,
  });
  await insertGroup({
    id: fixtures.groupAEmpty,
    companyId: kitIdentities.companies.a,
  });

  await insertCustomer({
    id: fixtures.customerAAssigned,
    companyId: kitIdentities.companies.a,
    groupId: fixtures.groupA,
    priceListId: fixtures.listACustomer,
  });
  await insertCustomer({
    id: fixtures.customerABare,
    companyId: kitIdentities.companies.a,
  });
  await insertCustomer({
    id: fixtures.customerAGroupOnly,
    companyId: kitIdentities.companies.a,
    groupId: fixtures.groupAEmpty,
  });
  await insertCustomer({
    id: fixtures.customerB,
    companyId: kitIdentities.companies.b,
  });

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-kit.test",
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
      getCustomerPricingFacts,
      { input: { customerId: fixtures.customerAAssigned } },
      { input: { customerId: fixtures.customerB } },
    ),
  ],
);

describe("customers.getCustomerPricingFacts", () => {
  it("returns the customer's list, group, and group list from one query", async () => {
    const result = await kit.invoke(getCustomerPricingFacts, {
      customerId: fixtures.customerAAssigned,
    });

    expect(result).toEqual({
      priceListId: fixtures.listACustomer,
      groupId: fixtures.groupA,
      groupPriceListId: fixtures.listAGroup,
    });
  });

  it("returns null assignments when the customer has no list or group", async () => {
    const result = await kit.invoke(getCustomerPricingFacts, {
      customerId: fixtures.customerABare,
    });

    expect(result).toEqual({
      priceListId: null,
      groupId: null,
      groupPriceListId: null,
    });
  });

  it("returns a group without a list as a null groupPriceListId", async () => {
    const result = await kit.invoke(getCustomerPricingFacts, {
      customerId: fixtures.customerAGroupOnly,
    });

    expect(result).toEqual({
      priceListId: null,
      groupId: fixtures.groupAEmpty,
      groupPriceListId: null,
    });
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        getCustomerPricingFacts,
        { customerId: fixtures.customerAAssigned },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a missing customerId and a malformed id", async () => {
    await expect(
      kit.invoke(getCustomerPricingFacts, {}),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(getCustomerPricingFacts, { customerId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails a missing or foreign customer with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit
      .invoke(getCustomerPricingFacts, { customerId: missingId })
      .then(
        () => {
          throw new Error("expected NotFoundError for a missing customer");
        },
        (error: unknown) => error,
      );
    const foreignError = await kit
      .invoke(getCustomerPricingFacts, {
        customerId: fixtures.customerB,
      })
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
