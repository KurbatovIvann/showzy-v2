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
import { products } from "@showzy/db/schema/catalog";
import { companyMembers } from "@showzy/db/schema/companies";
import { priceListEntries, priceLists } from "@showzy/db/schema/pricing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPriceList } from "./get-price-list.js";

const fixtures = {
  listA: randomUUID(),
  listAEmpty: randomUUID(),
  listB: randomUUID(),
  productA: randomUUID(),
  productA2: randomUUID(),
  entryA1: randomUUID(),
  entryA2: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();

  await kit.db.runtime.db.insert(priceLists).values([
    {
      id: fixtures.listA,
      companyId: kitIdentities.companies.a,
      name: "Wholesale",
    },
    {
      id: fixtures.listAEmpty,
      companyId: kitIdentities.companies.a,
      name: "Empty",
      isActive: false,
    },
    {
      id: fixtures.listB,
      companyId: kitIdentities.companies.b,
      name: "Foreign",
      isDefault: true,
    },
  ]);

  await kit.db.runtime.db.insert(products).values([
    {
      id: fixtures.productA,
      companyId: kitIdentities.companies.a,
      name: "Cake",
      basePriceMinor: 1500n,
    },
    {
      id: fixtures.productA2,
      companyId: kitIdentities.companies.a,
      name: "Pie",
      basePriceMinor: 800n,
    },
  ]);

  await kit.db.runtime.db.insert(priceListEntries).values([
    {
      id: fixtures.entryA1,
      companyId: kitIdentities.companies.a,
      priceListId: fixtures.listA,
      productId: fixtures.productA,
      priceMinor: 1200n,
    },
    {
      id: fixtures.entryA2,
      companyId: kitIdentities.companies.a,
      priceListId: fixtures.listA,
      productId: fixtures.productA2,
      priceMinor: 700n,
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@pricing-get-kit.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: kitIdentities.companies.a,
    userId: clerkUserId,
    role: "employee",
    permissions: { granted: [], denied: ["pricing:view"] },
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      getPriceList,
      { input: { id: fixtures.listA } },
      { input: { id: fixtures.listB } },
    ),
  ],
);

describe("pricing.getPriceList", () => {
  it("returns the own-tenant list with entryCount", async () => {
    const result = await kit.invoke(getPriceList, { id: fixtures.listA });

    expect(result).toMatchObject({
      id: fixtures.listA,
      name: "Wholesale",
      isDefault: false,
      isActive: true,
      entryCount: 2,
    });
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("returns an inactive list with zero entries", async () => {
    const result = await kit.invoke(getPriceList, { id: fixtures.listAEmpty });
    expect(result).toMatchObject({
      id: fixtures.listAEmpty,
      name: "Empty",
      isDefault: false,
      isActive: false,
      entryCount: 0,
    });
  });

  it("denies staff without pricing:view", async () => {
    await expect(
      kit.invoke(
        getPriceList,
        { id: fixtures.listA },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a malformed id", async () => {
    await expect(
      kit.invoke(getPriceList, { id: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails missing and foreign lists with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit.invoke(getPriceList, { id: missingId }).then(
      () => {
        throw new Error("expected NotFoundError for a missing price list");
      },
      (error: unknown) => error,
    );
    const foreignError = await kit
      .invoke(getPriceList, { id: fixtures.listB })
      .then(
        () => {
          throw new Error("expected NotFoundError for a foreign price list");
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
