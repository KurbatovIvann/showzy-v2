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
import { companyMembers } from "@showzy/db/schema/companies";
import { priceLists } from "@showzy/db/schema/pricing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listPriceLists } from "./list-price-lists.js";
import {
  formatListPriceListsCursor,
  LIST_PRICE_LISTS_MAX_LIMIT,
} from "./list-price-lists.contract.js";

const fixtures = {
  zuluDefault: randomUUID(),
  alpha: randomUUID(),
  beta: randomUUID(),
  pipeName: randomUUID(),
  inactiveMike: randomUUID(),
  foreign: randomUUID(),
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
    });
    expect(result.items[4]).toEqual({
      id: fixtures.inactiveMike,
      name: "Mike",
      isDefault: false,
      isActive: false,
    });
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

  it("rejects a bad cursor and an oversized limit", async () => {
    await expect(
      kit.invoke(listPriceLists, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listPriceLists, { limit: LIST_PRICE_LISTS_MAX_LIMIT + 1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listPriceLists, { limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
