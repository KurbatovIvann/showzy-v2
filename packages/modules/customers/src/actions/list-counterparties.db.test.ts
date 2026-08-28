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
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listCounterparties } from "./list-counterparties.js";
import {
  formatListCounterpartiesCursor,
  LIST_COUNTERPARTIES_MAX_LIMIT,
  LIST_COUNTERPARTIES_SEARCH_MAX,
} from "./list-counterparties.contract.js";

const fixtures = {
  newest: randomUUID(),
  linked: randomUUID(),
  ibanOnly: randomUUID(),
  older: randomUUID(),
  foreign: randomUUID(),
  customerA: randomUUID(),
  customerBare: randomUUID(),
  customerB: randomUUID(),
};

const clerkUserId = randomUUID();
const sampleEdrpou = "12345678";
const fixtureIban = "UA123456789012345678901234567";
const ibanSearchFragment = "901234567";

const stamps = {
  newest: new Date("2026-04-01T00:00:00.000Z"),
  linked: new Date("2026-03-01T00:00:00.000Z"),
  ibanOnly: new Date("2026-02-15T00:00:00.000Z"),
  older: new Date("2026-02-01T00:00:00.000Z"),
};

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
      id: fixtures.customerBare,
      companyId: kitIdentities.companies.a,
      name: "Bare Client",
      email: "bare@kit.test",
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
      id: fixtures.newest,
      companyId: kitIdentities.companies.a,
      name: "Zed Standalone",
      createdAt: stamps.newest,
      updatedAt: stamps.newest,
    },
    {
      id: fixtures.linked,
      companyId: kitIdentities.companies.a,
      customerId: fixtures.customerA,
      name: "Alpha Legal",
      edrpou: sampleEdrpou,
      createdAt: stamps.linked,
      updatedAt: stamps.linked,
    },
    {
      id: fixtures.ibanOnly,
      companyId: kitIdentities.companies.a,
      name: "Gamma Bank",
      iban: fixtureIban,
      createdAt: stamps.ibanOnly,
      updatedAt: stamps.ibanOnly,
    },
    {
      id: fixtures.older,
      companyId: kitIdentities.companies.a,
      name: "Beta Bread Co",
      createdAt: stamps.older,
      updatedAt: stamps.older,
    },
    {
      id: fixtures.foreign,
      companyId: kitIdentities.companies.b,
      customerId: fixtures.customerB,
      name: "Alpha Foreign",
      edrpou: sampleEdrpou,
      createdAt: stamps.newest,
      updatedAt: stamps.newest,
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-list-counterparties.test",
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
// filter is proven by "does not include another company's counterparties".
crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listCounterparties,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("customers.listCounterparties", () => {
  it("lists own-tenant counterparties newest-updated-first including standalone rows", async () => {
    const result = await kit.invoke(listCounterparties, {});

    expect(result.items.map((row) => row.id)).toEqual([
      fixtures.newest,
      fixtures.linked,
      fixtures.ibanOnly,
      fixtures.older,
    ]);
    expect(result.nextCursor).toBeNull();

    const linked = result.items[1];
    expect(linked).toEqual({
      id: fixtures.linked,
      name: "Alpha Legal",
      edrpou: sampleEdrpou,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      phone: null,
      email: null,
      notes: null,
      customerId: fixtures.customerA,
      customerName: "Alpha Cake",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });

    expect(result.items[0]).toMatchObject({
      id: fixtures.newest,
      name: "Zed Standalone",
      customerId: null,
      customerName: null,
    });
  });

  it("searches name and edrpou case-insensitively and does not search IBAN", async () => {
    const byName = await kit.invoke(listCounterparties, { search: "aLpHa" });
    expect(byName.items.map((row) => row.id)).toEqual([fixtures.linked]);
    expect(byName.items.map((row) => row.id)).not.toContain(fixtures.foreign);

    const byEdrpou = await kit.invoke(listCounterparties, {
      search: sampleEdrpou,
    });
    expect(byEdrpou.items.map((row) => row.id)).toEqual([fixtures.linked]);

    const byIban = await kit.invoke(listCounterparties, {
      search: ibanSearchFragment,
    });
    expect(byIban).toEqual({ items: [], nextCursor: null });
  });

  it("filters by own customer and returns an empty page for missing or foreign customers", async () => {
    const linked = await kit.invoke(listCounterparties, {
      customerId: fixtures.customerA,
    });
    expect(linked.items.map((row) => row.id)).toEqual([fixtures.linked]);
    expect(linked.items[0]).toMatchObject({
      customerId: fixtures.customerA,
      customerName: "Alpha Cake",
    });
    expect(linked.items.map((row) => row.id)).not.toContain(fixtures.newest);

    const bare = await kit.invoke(listCounterparties, {
      customerId: fixtures.customerBare,
    });
    expect(bare).toEqual({ items: [], nextCursor: null });

    const foreignCustomer = await kit.invoke(listCounterparties, {
      customerId: fixtures.customerB,
    });
    expect(foreignCustomer).toEqual({ items: [], nextCursor: null });
    expect(JSON.stringify(foreignCustomer)).not.toContain(fixtures.foreign);

    const missing = await kit.invoke(listCounterparties, {
      customerId: randomUUID(),
    });
    expect(missing).toEqual({ items: [], nextCursor: null });
  });

  it("paginates on updatedAt/id and stops at the last page", async () => {
    const first = await kit.invoke(listCounterparties, { limit: 2 });
    expect(first.items.map((row) => row.id)).toEqual([
      fixtures.newest,
      fixtures.linked,
    ]);
    expect(first.nextCursor).toBe(
      formatListCounterpartiesCursor(stamps.linked, fixtures.linked),
    );

    const second = await kit.invoke(listCounterparties, {
      limit: 2,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.id)).toEqual([
      fixtures.ibanOnly,
      fixtures.older,
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it("does not include another company's counterparties", async () => {
    const result = await kit.invoke(listCounterparties, {
      search: "Alpha",
    });
    expect(result.items.map((row) => row.id)).toEqual([fixtures.linked]);
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(fixtures.foreign);
    expect(blob).not.toContain(kitIdentities.companies.b);
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        listCounterparties,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a bad cursor, oversized limit, and empty search", async () => {
    await expect(
      kit.invoke(listCounterparties, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listCounterparties, {
        limit: LIST_COUNTERPARTIES_MAX_LIMIT + 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listCounterparties, { limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listCounterparties, { search: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listCounterparties, {
        search: "x".repeat(LIST_COUNTERPARTIES_SEARCH_MAX + 1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listCounterparties, { customerId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns an empty page when the search is only LIKE metacharacters", async () => {
    const wildcards = await kit.invoke(listCounterparties, { search: "%%" });
    const escaped = await kit.invoke(listCounterparties, { search: "\\" });
    expect(wildcards).toEqual({ items: [], nextCursor: null });
    expect(escaped).toEqual({ items: [], nextCursor: null });
  });
});
