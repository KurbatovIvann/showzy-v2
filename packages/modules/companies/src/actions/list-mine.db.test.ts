import { randomUUID } from "node:crypto";

import { PermissionDeniedError, ValidationError } from "@showzy/core/errors";
import {
  accountIsolationSuite,
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { auditLog, domainEvents } from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { companies, companyMembers } from "@showzy/db/schema/companies";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listMine } from "./list-mine.js";

const fixtures = {
  emptyUser: randomUUID(),
  multiUser: randomUUID(),
  companyFirst: randomUUID(),
  companySecond: randomUUID(),
  membershipFirst: randomUUID(),
  membershipSecond: randomUUID(),
};

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();

  await kit.db.runtime.db.insert(user).values([
    {
      id: fixtures.emptyUser,
      name: "No companies",
      email: "empty@companies-kit.test",
    },
    {
      id: fixtures.multiUser,
      name: "Two companies",
      email: "multi@companies-kit.test",
    },
  ]);

  await kit.db.runtime.db.insert(companies).values([
    {
      id: fixtures.companyFirst,
      name: "Zavod Zoryany",
      slug: "zavod-zoryany",
      prefix: "ZZ",
    },
    {
      id: fixtures.companySecond,
      name: "Atelier Amaltea",
      slug: "atelier-amaltea",
      prefix: "AA",
    },
  ]);

  // Explicit timestamps pin the stable order: the alphabetically-last
  // company was joined first and must stay first in the output.
  await kit.db.runtime.db.insert(companyMembers).values([
    {
      id: fixtures.membershipFirst,
      companyId: fixtures.companyFirst,
      userId: fixtures.multiUser,
      role: "owner",
      permissions: { granted: [], denied: [] },
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: fixtures.membershipSecond,
      companyId: fixtures.companySecond,
      userId: fixtures.multiUser,
      role: "manager",
      permissions: { granted: [], denied: [] },
      createdAt: new Date("2026-02-01T00:00:00Z"),
    },
  ]);
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listMine,
      { input: {}, userId: kitIdentities.users.anna },
      { input: {}, userId: kitIdentities.users.boris },
    ),
  ],
);

accountIsolationSuite(
  () => kit,
  [
    isolationCase(
      listMine,
      { input: {}, userId: kitIdentities.users.anna },
      { input: {}, userId: kitIdentities.users.boris },
    ),
  ],
);

describe("companies.listMine", () => {
  it("returns [] for an account with no memberships", async () => {
    const result = await kit.invoke(
      listMine,
      {},
      { userId: fixtures.emptyUser },
    );
    expect(result).toEqual({ memberships: [] });
  });

  it("returns the caller's single membership with the company view", async () => {
    const result = await kit.invoke(
      listMine,
      {},
      { userId: kitIdentities.users.anna },
    );
    expect(result.memberships).toHaveLength(1);
    expect(result.memberships[0]).toMatchObject({
      role: "owner",
      company: {
        id: kitIdentities.companies.a,
        name: "Konditerska Anna",
        slug: "konditerska-anna",
        prefix: "KA",
      },
    });
    const membershipRows = await kit.db.runtime.db
      .select({ id: companyMembers.id })
      .from(companyMembers)
      .where(eq(companyMembers.userId, kitIdentities.users.anna));
    expect(result.memberships[0]?.membershipId).toBe(membershipRows[0]?.id);
  });

  it("returns multiple memberships in membership-creation order, not name order", async () => {
    const result = await kit.invoke(
      listMine,
      {},
      { userId: fixtures.multiUser },
    );
    expect(result).toEqual({
      memberships: [
        {
          membershipId: fixtures.membershipFirst,
          role: "owner",
          company: {
            id: fixtures.companyFirst,
            name: "Zavod Zoryany",
            slug: "zavod-zoryany",
            prefix: "ZZ",
          },
        },
        {
          membershipId: fixtures.membershipSecond,
          role: "manager",
          company: {
            id: fixtures.companySecond,
            name: "Atelier Amaltea",
            slug: "atelier-amaltea",
            prefix: "AA",
          },
        },
      ],
    });
  });

  it("never returns another user's companies or memberships", async () => {
    const result = await kit.invoke(
      listMine,
      {},
      { userId: kitIdentities.users.boris },
    );
    expect(result.memberships.map((m) => m.company.id)).toEqual([
      kitIdentities.companies.b,
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(kitIdentities.companies.a);
    expect(serialized).not.toContain(fixtures.companyFirst);
    expect(serialized).not.toContain(fixtures.companySecond);
  });

  it("rejects any input identifier — the input is a strict empty object", async () => {
    await expect(
      kit.invoke(listMine, { userId: fixtures.multiUser }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      kit.invoke(listMine, { companyId: kitIdentities.companies.a }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(kit.invoke(listMine, null)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("denies a call without a session (defense in depth behind the 401 gate)", async () => {
    await expect(
      kit.buildTestContext("account", { session: null }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("writes no audit row and no domain event", async () => {
    const requestId = randomUUID();
    await kit.invoke(
      listMine,
      {},
      { userId: kitIdentities.users.anna },
      { request: { requestId } },
    );
    const auditRows = await kit.db.runtime.db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.requestId, requestId));
    const eventRows = await kit.db.runtime.db
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(eq(domainEvents.requestId, requestId));
    expect(auditRows).toEqual([]);
    expect(eventRows).toEqual([]);
  });
});
