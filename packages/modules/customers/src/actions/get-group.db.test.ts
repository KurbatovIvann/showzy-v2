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

import { getGroup } from "./get-group.js";

const fixtures = {
  groupA: randomUUID(),
  groupAEmpty: randomUUID(),
  groupB: randomUUID(),
  listA: randomUUID(),
  memberActive: randomUUID(),
  memberArchived: randomUUID(),
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
      id: fixtures.groupA,
      companyId: kitIdentities.companies.a,
      name: "Alpha",
      slug: "alpha",
      description: "Counted group",
      priceListId: fixtures.listA,
    },
    {
      id: fixtures.groupAEmpty,
      companyId: kitIdentities.companies.a,
      name: "Bare",
      slug: "bare",
    },
    {
      id: fixtures.groupB,
      companyId: kitIdentities.companies.b,
      name: "Bravo",
      slug: "bravo",
    },
  ]);

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.memberActive,
      companyId: kitIdentities.companies.a,
      name: "Active member",
      email: `active-${fixtures.memberActive}@example.com`,
      groupId: fixtures.groupA,
      status: "active",
    },
    {
      id: fixtures.memberArchived,
      companyId: kitIdentities.companies.a,
      name: "Archived member",
      email: `archived-${fixtures.memberArchived}@example.com`,
      groupId: fixtures.groupA,
      status: "archived",
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-get-group.test",
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
      getGroup,
      { input: { id: fixtures.groupA } },
      { input: { id: fixtures.groupB } },
    ),
  ],
);

describe("customers.getGroup", () => {
  it("returns the group view and counts only active members", async () => {
    const result = await kit.invoke(getGroup, { id: fixtures.groupA });

    expect(result).toMatchObject({
      id: fixtures.groupA,
      name: "Alpha",
      slug: "alpha",
      description: "Counted group",
      priceListId: fixtures.listA,
      memberCount: 1,
    });
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("returns a group with no members as memberCount 0", async () => {
    const result = await kit.invoke(getGroup, { id: fixtures.groupAEmpty });
    expect(result).toMatchObject({
      id: fixtures.groupAEmpty,
      name: "Bare",
      slug: "bare",
      description: null,
      priceListId: null,
      memberCount: 0,
    });
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        getGroup,
        { id: fixtures.groupA },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a malformed group id", async () => {
    await expect(
      kit.invoke(getGroup, { id: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails missing and foreign groups with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit.invoke(getGroup, { id: missingId }).then(
      () => {
        throw new Error("expected NotFoundError for a missing group");
      },
      (error: unknown) => error,
    );
    const foreignError = await kit
      .invoke(getGroup, { id: fixtures.groupB })
      .then(
        () => {
          throw new Error("expected NotFoundError for a foreign group");
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
