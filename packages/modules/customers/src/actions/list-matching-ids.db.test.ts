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
import { companyCustomers } from "@showzy/db/schema/customers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listMatchingIds } from "./list-matching-ids.js";
import { LIST_MATCHING_IDS_MAX } from "./list-matching-ids.contract.js";

const fixtures = {
  alpha: randomUUID(),
  cafe: randomUUID(),
  beta: randomUUID(),
  archived: randomUUID(),
  foreign: randomUUID(),
};

const clerkUserId = randomUUID();

const stamps = {
  archived: new Date("2026-05-01T00:00:00.000Z"),
  alpha: new Date("2026-04-01T00:00:00.000Z"),
  beta: new Date("2026-03-01T00:00:00.000Z"),
  foreign: new Date("2026-06-01T00:00:00.000Z"),
};

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.archived,
      companyId: kitIdentities.companies.a,
      name: "Old Thing",
      phone: "+380501000099",
      status: "archived",
      createdAt: stamps.archived,
      updatedAt: stamps.archived,
    },
    {
      id: fixtures.alpha,
      companyId: kitIdentities.companies.a,
      name: "Alpha Cake",
      phone: "+380501111111",
      email: `alpha-${fixtures.alpha}@kit.test`,
      createdAt: stamps.alpha,
      updatedAt: stamps.alpha,
    },
    {
      id: fixtures.cafe,
      companyId: kitIdentities.companies.a,
      name: "Caf\u00e9 Cake",
      phone: "+380509999991",
      email: `cafe-${fixtures.cafe}@kit.test`,
      createdAt: stamps.alpha,
      updatedAt: stamps.alpha,
    },
    {
      id: fixtures.beta,
      companyId: kitIdentities.companies.a,
      name: "Beta Bread",
      email: "beta-search@kit.test",
      createdAt: stamps.beta,
      updatedAt: stamps.beta,
    },
    {
      id: fixtures.foreign,
      companyId: kitIdentities.companies.b,
      name: "Alpha Foreign",
      phone: "+380502222222",
      email: `foreign-${fixtures.foreign}@kit.test`,
      createdAt: stamps.foreign,
      updatedAt: stamps.foreign,
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-list-matching-ids.test",
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
      listMatchingIds,
      { input: { query: "Alpha" } },
      {
        input: { query: "Alpha" },
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("customers.listMatchingIds", () => {
  it("returns bounded ids for name, phone, and email, including archived", async () => {
    const byName = await kit.invoke(listMatchingIds, {
      query: "  Alpha   Cake ",
    });
    expect(byName.truncated).toBe(false);
    expect(byName.ids).toEqual([fixtures.alpha]);
    expect(byName).not.toHaveProperty("items");

    const byPhone = await kit.invoke(listMatchingIds, { query: "111111" });
    expect(byPhone.ids).toEqual([fixtures.alpha]);

    const byEmail = await kit.invoke(listMatchingIds, {
      query: "BETA-SEARCH@",
    });
    expect(byEmail.ids).toEqual([fixtures.beta]);

    const archived = await kit.invoke(listMatchingIds, { query: "Old Thing" });
    expect(archived.ids).toEqual([fixtures.archived]);

    const byNfc = await kit.invoke(listMatchingIds, {
      query: "Cafe\u0301 Cake",
    });
    expect(byNfc.ids).toEqual([fixtures.cafe]);
  });

  it("does not leak another tenant's name or phone", async () => {
    const byForeignName = await kit.invoke(listMatchingIds, {
      query: "Alpha Foreign",
    });
    expect(byForeignName).toEqual({ ids: [], truncated: false });

    const byForeignPhone = await kit.invoke(listMatchingIds, {
      query: "222222",
    });
    expect(byForeignPhone).toEqual({ ids: [], truncated: false });

    const otherTenant = await kit.invoke(
      listMatchingIds,
      { query: "Alpha" },
      {
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.boris,
      },
    );
    expect(otherTenant.ids).toEqual([fixtures.foreign]);
    expect(otherTenant.ids).not.toContain(fixtures.alpha);
  });

  it("returns no ids when LIKE metacharacters strip the query", async () => {
    expect(await kit.invoke(listMatchingIds, { query: "%%" })).toEqual({
      ids: [],
      truncated: false,
    });
    expect(await kit.invoke(listMatchingIds, { query: "\\" })).toEqual({
      ids: [],
      truncated: false,
    });
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        listMatchingIds,
        { query: "Alpha" },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a missing or blank query", async () => {
    await expect(kit.invoke(listMatchingIds, {})).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      kit.invoke(listMatchingIds, { query: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("includes Катя Самбука for Каті Самбуки and keeps the other tenant out", async () => {
    const katyaA = randomUUID();
    const katyaB = randomUUID();
    await kit.db.runtime.db.insert(companyCustomers).values([
      {
        id: katyaA,
        companyId: kitIdentities.companies.a,
        name: "Катя Самбука",
        email: `katya-a-${katyaA}@kit.test`,
      },
      {
        id: katyaB,
        companyId: kitIdentities.companies.b,
        name: "Катя Самбука",
        email: `katya-b-${katyaB}@kit.test`,
      },
    ]);

    const listed = await kit.invoke(listMatchingIds, {
      query: "Каті Самбуки",
    });
    expect(listed.truncated).toBe(false);
    expect(listed.ids).toEqual([katyaA]);
    expect(listed.ids).not.toContain(katyaB);

    const otherTenant = await kit.invoke(
      listMatchingIds,
      { query: "Каті Самбуки" },
      {
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.boris,
      },
    );
    expect(otherTenant.ids).toEqual([katyaB]);
    expect(otherTenant.ids).not.toContain(katyaA);
  });

  it("returns every similar name id in the tenant instead of picking one", async () => {
    const sambuka = randomUUID();
    const sambukova = randomUUID();
    await kit.db.runtime.db.insert(companyCustomers).values([
      {
        id: sambuka,
        companyId: kitIdentities.companies.a,
        name: "Катя Самбука",
        email: `match-sambuka-${sambuka}@kit.test`,
      },
      {
        id: sambukova,
        companyId: kitIdentities.companies.a,
        name: "Катерина Самбукова",
        email: `match-sambukova-${sambukova}@kit.test`,
      },
    ]);

    const listed = await kit.invoke(listMatchingIds, {
      query: "Каті Самбуки",
    });
    expect(listed.ids).toEqual(expect.arrayContaining([sambuka, sambukova]));
    expect(new Set(listed.ids).size).toBeGreaterThanOrEqual(2);
    expect(listed.truncated).toBe(false);
  });

  it("does not let a short token match inside another name word", async () => {
    const customerA = randomUUID();
    const customerExtra = randomUUID();
    await kit.db.runtime.db.insert(companyCustomers).values([
      {
        id: customerA,
        companyId: kitIdentities.companies.a,
        name: "Customer A",
        email: `match-customer-a-${customerA}@kit.test`,
      },
      {
        id: customerExtra,
        companyId: kitIdentities.companies.a,
        name: "Customer Extra",
        email: `match-customer-extra-${customerExtra}@kit.test`,
      },
    ]);

    const listed = await kit.invoke(listMatchingIds, { query: "Customer A" });
    expect(listed.ids).toContain(customerA);
    expect(listed.ids).not.toContain(customerExtra);
  });

  it("sets truncated when more than 500 customers match", async () => {
    await kit.db.runtime.db.insert(companyCustomers).values(
      Array.from({ length: LIST_MATCHING_IDS_MAX + 1 }, (_, index) => ({
        id: randomUUID(),
        companyId: kitIdentities.companies.a,
        name: `MatchCap ${String(index)}`,
        email: `matchcap-${String(index)}@kit.test`,
        status: "active" as const,
      })),
    );
    const listed = await kit.invoke(listMatchingIds, { query: "MatchCap" });
    expect(listed.ids).toHaveLength(LIST_MATCHING_IDS_MAX);
    expect(listed.truncated).toBe(true);
  });
});
