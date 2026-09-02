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
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listLayouts } from "./list-layouts.js";
import { resolveLayout } from "./resolve-layout.js";
import {
  LAYOUT_TYPE_MISMATCH_MESSAGE,
  UNKNOWN_LAYOUT_KEY_MESSAGE,
} from "../services/layouts.js";

const clerkUserId = randomUUID();

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();
  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "No documents view",
    email: "noview@doc-gen-layouts-kit.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: kitIdentities.companies.a,
    userId: clerkUserId,
    role: "employee",
    permissions: { granted: [], denied: ["documents:view"] },
  });
});

afterAll(async () => {
  await kit.db.close();
});

// Staff catalog has no resource id: the inherited suite's foreign case is
// Anna selecting company B (membership deny). The catalog is code, not rows.
crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listLayouts,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
    isolationCase(
      resolveLayout,
      {
        input: {
          layoutKey: "payment_invoice.plain",
          type: "payment_invoice",
        },
      },
      {
        input: {
          layoutKey: "payment_invoice.plain",
          type: "payment_invoice",
        },
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("docGeneration.listLayouts", () => {
  it("lists all four system layouts when unfiltered", async () => {
    const result = await kit.invoke(listLayouts, {});
    expect(result.layouts.map((row) => row.key)).toEqual([
      "payment_invoice.plain",
      "payment_invoice.branded",
      "delivery_note.plain",
      "delivery_note.parties",
    ]);
    expect(
      result.layouts.filter((row) => row.isDefault).map((row) => row.key),
    ).toEqual(["payment_invoice.plain", "delivery_note.plain"]);
  });

  it("filters by document type", async () => {
    const invoices = await kit.invoke(listLayouts, { type: "payment_invoice" });
    expect(invoices.layouts.map((row) => row.key)).toEqual([
      "payment_invoice.plain",
      "payment_invoice.branded",
    ]);
    const notes = await kit.invoke(listLayouts, { type: "delivery_note" });
    expect(notes.layouts.map((row) => row.key)).toEqual([
      "delivery_note.plain",
      "delivery_note.parties",
    ]);
  });

  it("does not treat companyId as a grant", async () => {
    await expect(
      kit.invoke(listLayouts, { companyId: kitIdentities.companies.b }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("denies staff without documents:view", async () => {
    await expect(
      kit.invoke(
        listLayouts,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("docGeneration.resolveLayout", () => {
  it("returns the canonical key for catalog keys and legacy aliases", async () => {
    await expect(
      kit.invoke(resolveLayout, {
        layoutKey: "payment_invoice.branded",
        type: "payment_invoice",
      }),
    ).resolves.toEqual({
      key: "payment_invoice.branded",
      type: "payment_invoice",
    });
    await expect(
      kit.invoke(resolveLayout, {
        layoutKey: "payment_invoice",
        type: "payment_invoice",
      }),
    ).resolves.toEqual({
      key: "payment_invoice.plain",
      type: "payment_invoice",
    });
    await expect(
      kit.invoke(resolveLayout, {
        layoutKey: "delivery_note",
        type: "delivery_note",
      }),
    ).resolves.toEqual({
      key: "delivery_note.plain",
      type: "delivery_note",
    });
  });

  it("rejects an unknown key", async () => {
    await expect(
      kit.invoke(resolveLayout, {
        layoutKey: "payment_invoice.custom",
        type: "payment_invoice",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof ValidationError &&
        error.clientMessage === UNKNOWN_LAYOUT_KEY_MESSAGE
      );
    });
  });

  it("rejects a key/type mismatch", async () => {
    await expect(
      kit.invoke(resolveLayout, {
        layoutKey: "payment_invoice.plain",
        type: "delivery_note",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof ValidationError &&
        error.clientMessage === LAYOUT_TYPE_MISMATCH_MESSAGE
      );
    });
    await expect(
      kit.invoke(resolveLayout, {
        layoutKey: "payment_invoice",
        type: "delivery_note",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof ValidationError &&
        error.clientMessage === LAYOUT_TYPE_MISMATCH_MESSAGE
      );
    });
  });

  it("denies staff without documents:view", async () => {
    await expect(
      kit.invoke(
        resolveLayout,
        { layoutKey: "payment_invoice.plain", type: "payment_invoice" },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
