import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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
import { products, productVariants } from "@showzy/db/schema/catalog";
import { companyMembers } from "@showzy/db/schema/companies";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveLineReferences } from "./resolve-line-references.js";
import { RESOLVE_LINE_REFERENCES_MAX_LINES } from "./resolve-line-references.contract.js";

const fixtures = {
  alpha: randomUUID(),
  zero: randomUUID(),
  cafe: randomUUID(),
  coat: randomUUID(),
  twinUah: randomUUID(),
  twinEur: randomUUID(),
  archived: randomUUID(),
  foreign: randomUUID(),
  otherRedProduct: randomUUID(),
  variantRed: randomUUID(),
  variantBlue: randomUUID(),
  variantArchived: randomUUID(),
  variantOtherRed: randomUUID(),
  variantForeign: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

async function insertProduct(values: {
  id: string;
  companyId: string;
  name: string;
  basePriceMinor: bigint;
  currency?: string;
  status?: "active" | "archived";
}): Promise<void> {
  await kit.db.runtime.db.insert(products).values({
    id: values.id,
    companyId: values.companyId,
    name: values.name,
    basePriceMinor: values.basePriceMinor,
    ...(values.currency === undefined ? {} : { currency: values.currency }),
    ...(values.status === undefined ? {} : { status: values.status }),
  });
}

beforeAll(async () => {
  kit = await createTestKit();

  await insertProduct({
    id: fixtures.alpha,
    companyId: kitIdentities.companies.a,
    name: "Alpha",
    basePriceMinor: 1500n,
  });
  await insertProduct({
    id: fixtures.zero,
    companyId: kitIdentities.companies.a,
    name: "Zero",
    basePriceMinor: 0n,
  });
  await insertProduct({
    id: fixtures.cafe,
    companyId: kitIdentities.companies.a,
    name: "Caf\u00e9 Cake",
    basePriceMinor: 100n,
  });
  await insertProduct({
    id: fixtures.coat,
    companyId: kitIdentities.companies.a,
    name: "Coat",
    basePriceMinor: 800n,
  });
  await insertProduct({
    id: fixtures.twinUah,
    companyId: kitIdentities.companies.a,
    name: "TwinCake",
    basePriceMinor: 100n,
  });
  await insertProduct({
    id: fixtures.twinEur,
    companyId: kitIdentities.companies.a,
    name: "TwinCake",
    basePriceMinor: 100n,
    currency: "EUR",
  });
  await insertProduct({
    id: fixtures.archived,
    companyId: kitIdentities.companies.a,
    name: "Old Widget",
    basePriceMinor: 50n,
    status: "archived",
  });
  await insertProduct({
    id: fixtures.foreign,
    companyId: kitIdentities.companies.b,
    name: "Alpha",
    basePriceMinor: 100n,
  });
  await insertProduct({
    id: fixtures.otherRedProduct,
    companyId: kitIdentities.companies.a,
    name: "Other Red Host",
    basePriceMinor: 10n,
  });

  await kit.db.runtime.db.insert(productVariants).values([
    {
      id: fixtures.variantRed,
      companyId: kitIdentities.companies.a,
      productId: fixtures.coat,
      name: "Red",
    },
    {
      id: fixtures.variantBlue,
      companyId: kitIdentities.companies.a,
      productId: fixtures.coat,
      name: "Blue",
    },
    {
      id: fixtures.variantArchived,
      companyId: kitIdentities.companies.a,
      productId: fixtures.coat,
      name: "Vintage",
      status: "archived",
    },
    {
      id: fixtures.variantOtherRed,
      companyId: kitIdentities.companies.a,
      productId: fixtures.otherRedProduct,
      name: "Red",
    },
    {
      id: fixtures.variantForeign,
      companyId: kitIdentities.companies.b,
      productId: fixtures.foreign,
      name: "Red",
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@catalog-resolve-lines.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: kitIdentities.companies.a,
    userId: clerkUserId,
    role: "employee",
    permissions: { granted: [], denied: ["products:view"] },
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      resolveLineReferences,
      {
        input: {
          lines: [{ product: { by: "id", id: fixtures.alpha } }],
        },
      },
      {
        input: {
          lines: [{ product: { by: "id", id: fixtures.foreign } }],
        },
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("catalog.resolveLineReferences", () => {
  it("resolves unique query names the same as ids and preserves input order", async () => {
    const byId = await kit.invoke(resolveLineReferences, {
      lines: [
        { product: { by: "id", id: fixtures.zero } },
        { product: { by: "id", id: fixtures.alpha } },
      ],
    });
    const byQuery = await kit.invoke(resolveLineReferences, {
      lines: [
        { product: { by: "query", value: "Zero" } },
        { product: { by: "query", value: "  Alpha  " } },
      ],
    });
    expect(byId.lines.map((line) => line.productId)).toEqual([
      fixtures.zero,
      fixtures.alpha,
    ]);
    expect(byQuery.lines).toEqual(byId.lines);
    expect(byId.lines).toHaveLength(2);
  });

  it("matches NFC product names and scopes variant queries to the product", async () => {
    const cafe = await kit.invoke(resolveLineReferences, {
      lines: [{ product: { by: "query", value: "Cafe\u0301 Cake" } }],
    });
    expect(cafe.lines[0]?.productId).toBe(fixtures.cafe);

    const coatRed = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "query", value: "Coat" },
          variant: { by: "query", value: "Red" },
        },
      ],
    });
    expect(coatRed.lines[0]).toEqual({
      productId: fixtures.coat,
      productName: "Coat",
      variantId: fixtures.variantRed,
      variantName: "Red",
    });
  });

  it("lets id-path target archived catalog rows and rejects the same name on query-path", async () => {
    const byId = await kit.invoke(resolveLineReferences, {
      lines: [{ product: { by: "id", id: fixtures.archived } }],
    });
    expect(byId.lines[0]?.productId).toBe(fixtures.archived);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "Old Widget" } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const archivedVariant = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "id", id: fixtures.coat },
          variant: { by: "id", id: fixtures.variantArchived },
        },
      ],
    });
    expect(archivedVariant.lines[0]?.variantId).toBe(fixtures.variantArchived);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variant: { by: "query", value: "Vintage" },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("conflicts on ambiguous product names with currency discriminators", async () => {
    const error = await kit
      .invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "TwinCake" } }],
      })
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
    expect(error.clientMessage).toContain("TwinCake (UAH)");
    expect(error.clientMessage).toContain("TwinCake (EUR)");
    expect(error.clientMessage).toContain(fixtures.twinUah);
    expect(error.clientMessage).toContain(fixtures.twinEur);
  });

  it("conflicts on contains-only product hits and never auto-chooses", async () => {
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "Cake" } }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("conflicts on ambiguous variant names with canonical ids", async () => {
    const error = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variant: { by: "query", value: "e" },
          },
        ],
      })
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
    expect(error.clientMessage).toContain(fixtures.variantRed);
    expect(error.clientMessage).toContain(fixtures.variantBlue);
    expect(error.clientMessage).toContain("Red");
    expect(error.clientMessage).toContain("Blue");
  });

  it("returns not-found for missing, foreign, and mismatched variant ids", async () => {
    const missing = randomUUID();
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "id", id: missing } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "id", id: fixtures.foreign } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variant: { by: "id", id: fixtures.variantOtherRed },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "Nobody" } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies staff without products:view", async () => {
    await expect(
      kit.invoke(
        resolveLineReferences,
        { lines: [{ product: { by: "id", id: fixtures.alpha } }] },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an empty or oversized batch", async () => {
    await expect(
      kit.invoke(resolveLineReferences, { lines: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
    const oversized = Array.from(
      { length: RESOLVE_LINE_REFERENCES_MAX_LINES + 1 },
      () => ({ product: { by: "id" as const, id: fixtures.alpha } }),
    );
    await expect(
      kit.invoke(resolveLineReferences, { lines: oversized }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not per-line query or ctx.call", () => {
    const source = readFileSync(
      new URL("../services/resolve-line-references.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/ctx\.call\(/);
    // id + exact-name + per-query capped contains + variants for resolved products
    expect(source.match(/\.from\(/g)?.length).toBe(4);
  });

  it("resolves a unique query-path product when the combined contains scan is capped", async () => {
    const uniqueName = "ZzzExactSurvivor";
    const uniqueId = randomUUID();
    const otherUniqueName = "ZzzOtherSurvivor";
    const otherUniqueId = randomUUID();
    await insertProduct({
      id: uniqueId,
      companyId: kitIdentities.companies.a,
      name: uniqueName,
      basePriceMinor: 10n,
    });
    await insertProduct({
      id: otherUniqueId,
      companyId: kitIdentities.companies.a,
      name: otherUniqueName,
      basePriceMinor: 10n,
    });
    await kit.db.runtime.db.insert(products).values(
      Array.from({ length: 101 }, (_, index) => ({
        id: randomUUID(),
        companyId: kitIdentities.companies.a,
        name: `Aaa${uniqueName} ${String(index).padStart(3, "0")}`,
        basePriceMinor: 10n,
        status: "active" as const,
      })),
    );

    const resolved = await kit.invoke(resolveLineReferences, {
      lines: [
        { product: { by: "query", value: uniqueName } },
        { product: { by: "query", value: otherUniqueName } },
      ],
    });
    expect(resolved.lines).toEqual([
      {
        productId: uniqueId,
        productName: uniqueName,
        variantId: null,
        variantName: null,
      },
      {
        productId: otherUniqueId,
        productName: otherUniqueName,
        variantId: null,
        variantName: null,
      },
    ]);
  });

  it("does not drop a later contains query into NOT_FOUND after an earlier query fills 100 hits", async () => {
    const crowdingExactName = "AaaCapCrowd 000";
    const crowdingExactId = randomUUID();
    const laterContainsId = randomUUID();
    const laterContainsName = "ZzzLaterContainsTarget";
    await insertProduct({
      id: crowdingExactId,
      companyId: kitIdentities.companies.a,
      name: crowdingExactName,
      basePriceMinor: 10n,
    });
    await insertProduct({
      id: laterContainsId,
      companyId: kitIdentities.companies.a,
      name: laterContainsName,
      basePriceMinor: 10n,
    });
    await kit.db.runtime.db.insert(products).values(
      Array.from({ length: 100 }, (_, index) => ({
        id: randomUUID(),
        companyId: kitIdentities.companies.a,
        name: `AaaCapCrowd ${String(index + 1).padStart(3, "0")}`,
        basePriceMinor: 10n,
        status: "active" as const,
      })),
    );

    const error = await kit
      .invoke(resolveLineReferences, {
        lines: [
          { product: { by: "query", value: crowdingExactName } },
          { product: { by: "query", value: "LaterContainsTarget" } },
        ],
      })
      .then(
        () => {
          throw new Error("expected ConflictError");
        },
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).not.toBeInstanceOf(NotFoundError);
    if (!(error instanceof ConflictError)) {
      return;
    }
    expect(error.clientMessage).toContain(laterContainsId);
    expect(error.clientMessage).toContain(laterContainsName);
  });

  it("lists at most five conflict labels when more products contain the query", async () => {
    await kit.db.runtime.db.insert(products).values(
      Array.from({ length: 6 }, (_, index) => ({
        id: randomUUID(),
        companyId: kitIdentities.companies.a,
        name: `MatchCap ${String(index)}`,
        basePriceMinor: 10n,
        status: "active" as const,
      })),
    );
    const error = await kit
      .invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "MatchCap" } }],
      })
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
