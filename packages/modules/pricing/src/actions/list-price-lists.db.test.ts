import { randomUUID } from "node:crypto";

import { PermissionDeniedError, ValidationError } from "@showzy/core/errors";
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

import { listPriceLists } from "./list-price-lists.js";
import {
  formatListPriceListsCursor,
  LIST_PRICE_LISTS_MAX_LIMIT,
  LIST_PRICE_LISTS_QUERY_MAX,
} from "./list-price-lists.contract.js";

const fixtures = {
  zuluDefault: randomUUID(),
  alpha: randomUUID(),
  beta: randomUUID(),
  pipeName: randomUUID(),
  inactiveMike: randomUUID(),
  foreign: randomUUID(),
  productA: randomUUID(),
  productA2: randomUUID(),
  entryAlpha1: randomUUID(),
  entryAlpha2: randomUUID(),
  entryMike: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

async function insertList(values: {
  id: string;
  companyId: string;
  name: string;
  isDefault?: boolean;
  isActive?: boolean;
}): Promise<void> {
  await kit.db.runtime.db.insert(priceLists).values({
    id: values.id,
    companyId: values.companyId,
    name: values.name,
    ...(values.isDefault === undefined ? {} : { isDefault: values.isDefault }),
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  });
}

beforeAll(async () => {
  kit = await createTestKit();

  await insertList({
    id: fixtures.beta,
    companyId: kitIdentities.companies.a,
    name: "Beta",
  });
  await insertList({
    id: fixtures.alpha,
    companyId: kitIdentities.companies.a,
    name: "Alpha",
  });
  await insertList({
    id: fixtures.pipeName,
    companyId: kitIdentities.companies.a,
    name: "C|Special",
  });
  await insertList({
    id: fixtures.inactiveMike,
    companyId: kitIdentities.companies.a,
    name: "Mike",
    isActive: false,
  });
  await insertList({
    id: fixtures.zuluDefault,
    companyId: kitIdentities.companies.a,
    name: "Zulu",
    isDefault: true,
  });
  await insertList({
    id: fixtures.foreign,
    companyId: kitIdentities.companies.b,
    name: "Alpha",
    isDefault: true,
  });

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
      id: fixtures.entryAlpha1,
      companyId: kitIdentities.companies.a,
      priceListId: fixtures.alpha,
      productId: fixtures.productA,
      priceMinor: 1200n,
    },
    {
      id: fixtures.entryAlpha2,
      companyId: kitIdentities.companies.a,
      priceListId: fixtures.alpha,
      productId: fixtures.productA2,
      priceMinor: 700n,
    },
    {
      id: fixtures.entryMike,
      companyId: kitIdentities.companies.a,
      priceListId: fixtures.inactiveMike,
      productId: fixtures.productA,
      priceMinor: 900n,
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@pricing-list-kit.test",
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

// Staff lists have no resource id: the inherited suite's foreign case is
// Anna selecting company B (membership deny). The handler's company_id
// filter is proven by "does not include another company's price lists".
crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listPriceLists,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("pricing.listPriceLists", () => {
  it("lists own-tenant lists default-first then name, including inactive", async () => {
    const result = await kit.invoke(listPriceLists, {});

    expect(result.items.map((row) => row.id)).toEqual([
      fixtures.zuluDefault,
      fixtures.alpha,
      fixtures.beta,
      fixtures.pipeName,
      fixtures.inactiveMike,
    ]);
    expect(result.nextCursor).toBeNull();

    expect(result.items[0]).toEqual({
      id: fixtures.zuluDefault,
      name: "Zulu",
      isDefault: true,
      isActive: true,
      entryCount: 0,
    });
    expect(result.items[1]).toEqual({
      id: fixtures.alpha,
      name: "Alpha",
      isDefault: false,
      isActive: true,
      entryCount: 2,
    });
    expect(result.items[4]).toEqual({
      id: fixtures.inactiveMike,
      name: "Mike",
      isDefault: false,
      isActive: false,
      entryCount: 1,
    });
  });

  it("keeps {} and { limit: 50 } picker-safe, including inactive lists", async () => {
    for (const input of [{}, { limit: 50 }] as const) {
      const result = await kit.invoke(listPriceLists, input);
      expect(result.items.map((row) => row.id)).toContain(
        fixtures.inactiveMike,
      );
      for (const row of result.items) {
        expect(row).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            isDefault: expect.any(Boolean),
            isActive: expect.any(Boolean),
          }),
        );
      }
    }
  });

  it("filters availability active and inactive", async () => {
    const active = await kit.invoke(listPriceLists, { availability: "active" });
    expect(active.items.map((row) => row.id)).toEqual([
      fixtures.zuluDefault,
      fixtures.alpha,
      fixtures.beta,
      fixtures.pipeName,
    ]);
    expect(active.items.map((row) => row.id)).not.toContain(
      fixtures.inactiveMike,
    );

    const inactive = await kit.invoke(listPriceLists, {
      availability: "inactive",
    });
    expect(inactive.items.map((row) => row.id)).toEqual([
      fixtures.inactiveMike,
    ]);
  });

  it("searches names case-insensitively and strips LIKE metacharacters", async () => {
    const search = await kit.invoke(listPriceLists, { query: "aLpHa" });
    expect(search.items.map((row) => row.id)).toEqual([fixtures.alpha]);
    expect(search.items.map((row) => row.id)).not.toContain(fixtures.foreign);

    const strippedWildcard = await kit.invoke(listPriceLists, {
      query: "Alpha%",
    });
    expect(strippedWildcard.items.map((row) => row.id)).toEqual([
      fixtures.alpha,
    ]);
  });

  it("paginates from the default list onto named non-defaults", async () => {
    const first = await kit.invoke(listPriceLists, { limit: 1 });
    expect(first.items.map((row) => row.id)).toEqual([fixtures.zuluDefault]);
    expect(first.nextCursor).toBe(
      formatListPriceListsCursor(true, fixtures.zuluDefault, "Zulu"),
    );

    const rest = await kit.invoke(listPriceLists, {
      limit: 10,
      cursor: first.nextCursor ?? "",
    });
    expect(rest.items.map((row) => row.id)).toEqual([
      fixtures.alpha,
      fixtures.beta,
      fixtures.pipeName,
      fixtures.inactiveMike,
    ]);
    expect(rest.nextCursor).toBeNull();
  });

  it("paginates on isDefault/name/id including a name that contains a pipe", async () => {
    const first = await kit.invoke(listPriceLists, { limit: 2 });
    expect(first.items.map((row) => row.id)).toEqual([
      fixtures.zuluDefault,
      fixtures.alpha,
    ]);
    expect(first.nextCursor).toBe(
      formatListPriceListsCursor(false, fixtures.alpha, "Alpha"),
    );

    const second = await kit.invoke(listPriceLists, {
      limit: 2,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.id)).toEqual([
      fixtures.beta,
      fixtures.pipeName,
    ]);
    expect(second.nextCursor).toBe(
      formatListPriceListsCursor(false, fixtures.pipeName, "C|Special"),
    );

    const third = await kit.invoke(listPriceLists, {
      limit: 2,
      cursor: second.nextCursor ?? "",
    });
    expect(third.items.map((row) => row.id)).toEqual([fixtures.inactiveMike]);
    expect(third.nextCursor).toBeNull();
  });

  it("does not include another company's price lists", async () => {
    const result = await kit.invoke(listPriceLists, {});
    expect(result.items.map((row) => row.id)).not.toContain(fixtures.foreign);
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(fixtures.foreign);
    expect(blob).not.toContain(kitIdentities.companies.b);
  });

  it("denies staff without pricing:view", async () => {
    await expect(
      kit.invoke(
        listPriceLists,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a bad cursor, oversized limit, and oversized or blank query", async () => {
    await expect(
      kit.invoke(listPriceLists, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listPriceLists, { limit: LIST_PRICE_LISTS_MAX_LIMIT + 1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listPriceLists, { limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listPriceLists, { query: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listPriceLists, {
        query: "x".repeat(LIST_PRICE_LISTS_QUERY_MAX + 1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns an empty page when the search is only LIKE metacharacters", async () => {
    const wildcards = await kit.invoke(listPriceLists, { query: "%%" });
    const escaped = await kit.invoke(listPriceLists, { query: "\\" });
    expect(wildcards).toEqual({ items: [], nextCursor: null });
    expect(escaped).toEqual({ items: [], nextCursor: null });
  });
});
