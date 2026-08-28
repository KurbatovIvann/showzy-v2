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
import { companyCustomers, customerGroups } from "@showzy/db/schema/customers";
import { priceLists } from "@showzy/db/schema/pricing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listGroups } from "./list-groups.js";
import {
  formatListGroupsCursor,
  LIST_GROUPS_MAX_LIMIT,
  LIST_GROUPS_SEARCH_MAX,
} from "./list-groups.contract.js";

const fixtures = {
  alpha: randomUUID(),
  pipeName: randomUUID(),
  zebra: randomUUID(),
  vip: randomUUID(),
  foreign: randomUUID(),
  listA: randomUUID(),
  memberActive: randomUUID(),
  memberArchived: randomUUID(),
  vipMemberOne: randomUUID(),
  vipMemberTwo: randomUUID(),
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

  await kit.db.runtime.db.insert(customerGroups).values([
    {
      id: fixtures.zebra,
      companyId: kitIdentities.companies.a,
      name: "Zebra",
      slug: "zebra",
      sortOrder: 0,
    },
    {
      id: fixtures.alpha,
      companyId: kitIdentities.companies.a,
      name: "Alpha",
      slug: "alpha",
      description: "Counted group",
      priceListId: fixtures.listA,
      sortOrder: 0,
    },
    {
      id: fixtures.pipeName,
      companyId: kitIdentities.companies.a,
      name: "C|Special",
      slug: "c-special",
      sortOrder: 0,
    },
    {
      id: fixtures.vip,
      companyId: kitIdentities.companies.a,
      name: "VIP",
      slug: "vip",
      sortOrder: 1,
    },
    {
      id: fixtures.foreign,
      companyId: kitIdentities.companies.b,
      name: "Alpha",
      slug: "alpha",
      sortOrder: 0,
    },
  ]);

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.memberActive,
      companyId: kitIdentities.companies.a,
      name: "Active member",
      email: `active-${fixtures.memberActive}@example.com`,
      groupId: fixtures.alpha,
      status: "active",
    },
    {
      id: fixtures.memberArchived,
      companyId: kitIdentities.companies.a,
      name: "Archived member",
      email: `archived-${fixtures.memberArchived}@example.com`,
      groupId: fixtures.alpha,
      status: "archived",
    },
    {
      id: fixtures.vipMemberOne,
      companyId: kitIdentities.companies.a,
      name: "VIP one",
      email: `vip-one-${fixtures.vipMemberOne}@example.com`,
      groupId: fixtures.vip,
      status: "active",
    },
    {
      id: fixtures.vipMemberTwo,
      companyId: kitIdentities.companies.a,
      name: "VIP two",
      email: `vip-two-${fixtures.vipMemberTwo}@example.com`,
      groupId: fixtures.vip,
      status: "active",
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-list-groups.test",
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

// Staff lists have no resource id: the inherited suite's foreign case is
// Anna selecting company B (membership deny). The handler's company_id
// filter is proven by "does not include another company's groups".
crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listGroups,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("customers.listGroups", () => {
  it("lists own-tenant groups by sort_order then name, counting only active members", async () => {
    const result = await kit.invoke(listGroups, {});

    expect(result.items.map((row) => row.id)).toEqual([
      fixtures.alpha,
      fixtures.pipeName,
      fixtures.zebra,
      fixtures.vip,
    ]);
    expect(result.nextCursor).toBeNull();

    const alpha = result.items[0];
    expect(alpha).toMatchObject({
      id: fixtures.alpha,
      name: "Alpha",
      slug: "alpha",
      description: "Counted group",
      priceListId: fixtures.listA,
      memberCount: 1,
    });
    expect(typeof alpha?.createdAt).toBe("string");
    expect(typeof alpha?.updatedAt).toBe("string");

    expect(result.items[1]).toMatchObject({
      id: fixtures.pipeName,
      name: "C|Special",
      memberCount: 0,
    });
    expect(result.items[2]).toMatchObject({
      id: fixtures.zebra,
      name: "Zebra",
      memberCount: 0,
    });
    expect(result.items[3]).toMatchObject({
      id: fixtures.vip,
      name: "VIP",
      memberCount: 2,
    });
  });

  it("searches names case-insensitively", async () => {
    const search = await kit.invoke(listGroups, { search: "aLpHa" });
    expect(search.items.map((row) => row.id)).toEqual([fixtures.alpha]);
    expect(search.items.map((row) => row.id)).not.toContain(fixtures.foreign);
  });

  it("paginates on sort_order/name/id including a name that contains a pipe", async () => {
    const first = await kit.invoke(listGroups, { limit: 2 });
    expect(first.items.map((row) => row.id)).toEqual([
      fixtures.alpha,
      fixtures.pipeName,
    ]);
    expect(first.nextCursor).toBe(
      formatListGroupsCursor(0, fixtures.pipeName, "C|Special"),
    );

    const second = await kit.invoke(listGroups, {
      limit: 2,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.id)).toEqual([
      fixtures.zebra,
      fixtures.vip,
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it("does not include another company's groups", async () => {
    const result = await kit.invoke(listGroups, { search: "Alpha" });
    expect(result.items.map((row) => row.id)).toEqual([fixtures.alpha]);
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(fixtures.foreign);
    expect(blob).not.toContain(kitIdentities.companies.b);
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        listGroups,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a bad cursor, oversized limit, and empty search", async () => {
    await expect(
      kit.invoke(listGroups, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listGroups, { limit: LIST_GROUPS_MAX_LIMIT + 1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(kit.invoke(listGroups, { limit: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );

    await expect(
      kit.invoke(listGroups, { search: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listGroups, {
        search: "x".repeat(LIST_GROUPS_SEARCH_MAX + 1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns an empty page when the search is only LIKE metacharacters", async () => {
    const wildcards = await kit.invoke(listGroups, { search: "%%" });
    const escaped = await kit.invoke(listGroups, { search: "\\" });
    expect(wildcards).toEqual({ items: [], nextCursor: null });
    expect(escaped).toEqual({ items: [], nextCursor: null });
  });
});
