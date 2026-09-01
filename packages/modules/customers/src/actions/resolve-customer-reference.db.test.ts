import { randomUUID } from "node:crypto";

import {
  ConflictError,
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
import { companyCustomers } from "@showzy/db/schema/customers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveCustomerReference } from "./resolve-customer-reference.js";

const fixtures = {
  alpha: randomUUID(),
  cafe: randomUUID(),
  twinA: randomUUID(),
  twinB: randomUUID(),
  archived: randomUUID(),
  foreign: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.alpha,
      companyId: kitIdentities.companies.a,
      name: "Alpha Cake",
      phone: "+380501111111",
      email: `alpha-${fixtures.alpha}@kit.test`,
      notes: "secret-note-alpha",
    },
    {
      id: fixtures.cafe,
      companyId: kitIdentities.companies.a,
      name: "Caf\u00e9 Cake",
      phone: "+380509999991",
      email: `cafe-${fixtures.cafe}@kit.test`,
    },
    {
      id: fixtures.twinA,
      companyId: kitIdentities.companies.a,
      name: "Katya",
      phone: "+380501112233",
      email: "katya-a@kit.test",
      notes: "secret-note-twin-a",
    },
    {
      id: fixtures.twinB,
      companyId: kitIdentities.companies.a,
      name: "Katya",
      phone: "+380504445566",
      email: "katya-b@kit.test",
      notes: "secret-note-twin-b",
    },
    {
      id: fixtures.archived,
      companyId: kitIdentities.companies.a,
      name: "Old Thing",
      phone: "+380501000099",
      status: "archived",
    },
    {
      id: fixtures.foreign,
      companyId: kitIdentities.companies.b,
      name: "Alpha Cake",
      phone: "+380502222222",
      email: `foreign-${fixtures.foreign}@kit.test`,
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@customers-resolve-ref.test",
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
      resolveCustomerReference,
      { input: { by: "id", id: fixtures.alpha } },
      {
        input: { by: "id", id: fixtures.foreign },
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("customers.resolveCustomerReference", () => {
  it("resolves a unique query and an id with the same canonical customer", async () => {
    const byId = await kit.invoke(resolveCustomerReference, {
      by: "id",
      id: fixtures.alpha,
    });
    const byQuery = await kit.invoke(resolveCustomerReference, {
      by: "query",
      value: "  Alpha   Cake ",
    });
    expect(byId).toEqual({ customerId: fixtures.alpha, name: "Alpha Cake" });
    expect(byQuery).toEqual(byId);
    expect(byQuery).not.toHaveProperty("notes");
    expect(byQuery).not.toHaveProperty("phone");
  });

  it("matches NFC query to a unique active name", async () => {
    const byNfc = await kit.invoke(resolveCustomerReference, {
      by: "query",
      value: "Cafe\u0301 Cake",
    });
    expect(byNfc.customerId).toBe(fixtures.cafe);
  });

  it("lets id-path target archived and rejects the same name on query-path", async () => {
    const byId = await kit.invoke(resolveCustomerReference, {
      by: "id",
      id: fixtures.archived,
    });
    expect(byId).toEqual({ customerId: fixtures.archived, name: "Old Thing" });
    await expect(
      kit.invoke(resolveCustomerReference, {
        by: "query",
        value: "Old Thing",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("conflicts on an ambiguous name with at most five discriminated labels and no notes", async () => {
    const error = await kit
      .invoke(resolveCustomerReference, { by: "query", value: "Katya" })
      .then(
        () => {
          throw new Error("expected ConflictError");
        },
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(ConflictError);
    if (!(error instanceof ConflictError)) {
      return;
    }
    expect(error.clientMessage).toContain("…2233");
    expect(error.clientMessage).toContain("…5566");
    expect(error.clientMessage).not.toContain("secret-note");
    expect(error.clientMessage).not.toContain(fixtures.twinA);
  });

  it("conflicts on a contains-only hit and never auto-chooses", async () => {
    await expect(
      kit.invoke(resolveCustomerReference, { by: "query", value: "Cake" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns not-found for a missing id, a foreign id, and a zero query", async () => {
    const missing = randomUUID();
    const missingId = await kit
      .invoke(resolveCustomerReference, { by: "id", id: missing })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (caught: unknown) => caught,
      );
    const foreignId = await kit
      .invoke(resolveCustomerReference, { by: "id", id: fixtures.foreign })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (caught: unknown) => caught,
      );
    expect(missingId).toBeInstanceOf(NotFoundError);
    expect(foreignId).toBeInstanceOf(NotFoundError);
    if (
      missingId instanceof NotFoundError &&
      foreignId instanceof NotFoundError
    ) {
      expect(missingId.clientMessage).toBe(foreignId.clientMessage);
    }
    await expect(
      kit.invoke(resolveCustomerReference, {
        by: "query",
        value: "Nobody Here",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not leak another tenant's unique name", async () => {
    const otherTenant = await kit.invoke(
      resolveCustomerReference,
      { by: "query", value: "Alpha Cake" },
      {
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.boris,
      },
    );
    expect(otherTenant.customerId).toBe(fixtures.foreign);
    await expect(
      kit.invoke(resolveCustomerReference, {
        by: "query",
        value: "Alpha Foreign",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies staff without customers:view", async () => {
    await expect(
      kit.invoke(
        resolveCustomerReference,
        { by: "id", id: fixtures.alpha },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a missing or blank query", async () => {
    await expect(
      kit.invoke(resolveCustomerReference, {}),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      kit.invoke(resolveCustomerReference, { by: "query", value: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists at most five conflict labels when more customers contain the query", async () => {
    await kit.db.runtime.db.insert(companyCustomers).values(
      Array.from({ length: 6 }, (_, index) => ({
        id: randomUUID(),
        companyId: kitIdentities.companies.a,
        name: `MatchCap ${String(index)}`,
        email: `matchcap-${String(index)}@kit.test`,
        status: "active" as const,
      })),
    );
    const error = await kit
      .invoke(resolveCustomerReference, { by: "query", value: "MatchCap" })
      .then(
        () => {
          throw new Error("expected ConflictError");
        },
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(ConflictError);
    if (!(error instanceof ConflictError)) {
      return;
    }
    const labels = [...error.clientMessage.matchAll(/MatchCap \d/g)];
    expect(labels.length).toBe(5);
    expect(error.clientMessage).not.toContain("MatchCap 5");
  });
});
