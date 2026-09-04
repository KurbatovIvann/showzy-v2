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

import { ReferenceResolutionConflictError } from "../services/reference-resolution-conflict.js";
import { resolveLineReferences } from "./resolve-line-references.js";
import {
  RESOLVE_LINE_REFERENCES_MAX_LINES,
  VARIANT_AND_SELECTION_EXCLUSIVE_MESSAGE,
  VARIANT_SELECTION_OPTIONS_MAX,
} from "./resolve-line-references.contract.js";

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
  retiredBox: randomUUID(),
  macarons: randomUUID(),
  variantRed: randomUUID(),
  variantBlue: randomUUID(),
  variantArchived: randomUUID(),
  variantOtherRed: randomUUID(),
  variantForeign: randomUUID(),
  variantRetired: randomUUID(),
  macaronLemon: randomUUID(),
  macaronChocolate: randomUUID(),
  macaronVanilla: randomUUID(),
  macaronRaspberry: randomUUID(),
  macaronPistachio: randomUUID(),
  macaronSaltedCaramel: randomUUID(),
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

function expectResolutionConflict(
  error: unknown,
): ReferenceResolutionConflictError {
  expect(error).toBeInstanceOf(ReferenceResolutionConflictError);
  expect(error).toBeInstanceOf(ConflictError);
  if (!(error instanceof ReferenceResolutionConflictError)) {
    throw new Error("expected ReferenceResolutionConflictError");
  }
  expect(error.code).toBe("CONFLICT");
  return error;
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
  await insertProduct({
    id: fixtures.retiredBox,
    companyId: kitIdentities.companies.a,
    name: "Retired Box",
    basePriceMinor: 20n,
  });
  await insertProduct({
    id: fixtures.macarons,
    companyId: kitIdentities.companies.a,
    name: "Macarons",
    basePriceMinor: 300n,
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
    {
      id: fixtures.variantRetired,
      companyId: kitIdentities.companies.a,
      productId: fixtures.retiredBox,
      name: "Old Filling",
      status: "archived",
    },
    {
      id: fixtures.macaronLemon,
      companyId: kitIdentities.companies.a,
      productId: fixtures.macarons,
      name: "Lemon",
    },
    {
      id: fixtures.macaronChocolate,
      companyId: kitIdentities.companies.a,
      productId: fixtures.macarons,
      name: "Chocolate",
    },
    {
      id: fixtures.macaronVanilla,
      companyId: kitIdentities.companies.a,
      productId: fixtures.macarons,
      name: "Vanilla",
    },
    {
      id: fixtures.macaronRaspberry,
      companyId: kitIdentities.companies.a,
      productId: fixtures.macarons,
      name: "Raspberry",
    },
    {
      id: fixtures.macaronPistachio,
      companyId: kitIdentities.companies.a,
      productId: fixtures.macarons,
      name: "Pistachio",
    },
    {
      id: fixtures.macaronSaltedCaramel,
      companyId: kitIdentities.companies.a,
      productId: fixtures.macarons,
      name: "Salted Caramel",
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

  it("resolves simple products with unspecified or base to variantId null", async () => {
    const omitted = await kit.invoke(resolveLineReferences, {
      lines: [{ product: { by: "id", id: fixtures.alpha } }],
    });
    const unspecified = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "id", id: fixtures.alpha },
          variantSelection: { kind: "unspecified" },
        },
      ],
    });
    const base = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "id", id: fixtures.alpha },
          variantSelection: { kind: "base" },
        },
      ],
    });
    const expected = {
      productId: fixtures.alpha,
      productName: "Alpha",
      variantId: null,
      variantName: null,
    };
    expect(omitted.lines[0]).toEqual(expected);
    expect(unspecified.lines[0]).toEqual(expected);
    expect(base.lines[0]).toEqual(expected);
  });

  it("matches NFC product names and unique active variant query or id", async () => {
    const cafe = await kit.invoke(resolveLineReferences, {
      lines: [{ product: { by: "query", value: "Cafe\u0301 Cake" } }],
    });
    expect(cafe.lines[0]?.productId).toBe(fixtures.cafe);

    const coatRedQuery = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "query", value: "Coat" },
          variantSelection: {
            kind: "reference",
            ref: { by: "query", value: "Red" },
          },
        },
      ],
    });
    const coatRedId = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "id", id: fixtures.coat },
          variantSelection: {
            kind: "reference",
            ref: { by: "id", id: fixtures.variantRed },
          },
        },
      ],
    });
    const expected = {
      productId: fixtures.coat,
      productName: "Coat",
      variantId: fixtures.variantRed,
      variantName: "Red",
    };
    expect(coatRedQuery.lines[0]).toEqual(expected);
    expect(coatRedId.lines[0]).toEqual(expected);
  });

  it("maps legacy variant EntityRef to reference", async () => {
    const legacy = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "query", value: "Coat" },
          variant: { by: "query", value: "Red" },
        },
      ],
    });
    expect(legacy.lines[0]).toEqual({
      productId: fixtures.coat,
      productName: "Coat",
      variantId: fixtures.variantRed,
      variantName: "Red",
    });
  });

  it("zips a mixed batch in input order", async () => {
    const resolved = await kit.invoke(resolveLineReferences, {
      lines: [
        { product: { by: "id", id: fixtures.alpha } },
        {
          product: { by: "id", id: fixtures.coat },
          variantSelection: {
            kind: "reference",
            ref: { by: "id", id: fixtures.variantBlue },
          },
        },
        { product: { by: "query", value: "Zero" } },
      ],
    });
    expect(resolved.lines).toEqual([
      {
        productId: fixtures.alpha,
        productName: "Alpha",
        variantId: null,
        variantName: null,
      },
      {
        productId: fixtures.coat,
        productName: "Coat",
        variantId: fixtures.variantBlue,
        variantName: "Blue",
      },
      {
        productId: fixtures.zero,
        productName: "Zero",
        variantId: null,
        variantName: null,
      },
    ]);
  });

  it("resolves a unique variant query without splitting a combined phrase", async () => {
    const lemon = await kit.invoke(resolveLineReferences, {
      lines: [
        {
          product: { by: "query", value: "Macarons" },
          variantSelection: {
            kind: "reference",
            ref: { by: "query", value: "Lemon" },
          },
        },
      ],
    });
    expect(lemon.lines[0]).toEqual({
      productId: fixtures.macarons,
      productName: "Macarons",
      variantId: fixtures.macaronLemon,
      variantName: "Lemon",
    });
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "Macarons Lemon" } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("requires an active variant for unspecified or base on a variable product", async () => {
    const unspecified = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variantSelection: { kind: "unspecified" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const omitted = await kit
      .invoke(resolveLineReferences, {
        lines: [{ product: { by: "id", id: fixtures.coat } }],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const base = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variantSelection: { kind: "base" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );

    for (const error of [unspecified, omitted, base]) {
      const conflict = expectResolutionConflict(error);
      expect(conflict.reason).toBe("variant_required");
      expect(conflict.target).toEqual({
        kind: "order_line_variant",
        lineIndex: 0,
        productId: fixtures.coat,
        productName: "Coat",
      });
      expect(conflict.options).toEqual([
        { id: fixtures.variantBlue, label: "Blue" },
        { id: fixtures.variantRed, label: "Red" },
      ]);
      expect(conflict.optionsTruncated).toBe(false);
      expect(conflict.options.map((option) => option.id)).not.toContain(
        fixtures.variantArchived,
      );
      expect(conflict.options.map((option) => option.id)).not.toContain(
        fixtures.variantForeign,
      );
      expect(conflict.options.map((option) => option.id)).not.toContain(
        fixtures.variantOtherRed,
      );
    }
  });

  it("returns no_active_variants for archived-only variable products", async () => {
    const unspecified = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.retiredBox },
            variantSelection: { kind: "unspecified" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const base = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.retiredBox },
            variantSelection: { kind: "base" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    for (const error of [unspecified, base]) {
      const conflict = expectResolutionConflict(error);
      expect(conflict.reason).toBe("no_active_variants");
      expect(conflict.target).toEqual({
        kind: "order_line_variant",
        lineIndex: 0,
        productId: fixtures.retiredBox,
        productName: "Retired Box",
      });
      expect(conflict.options).toEqual([]);
      expect(conflict.optionsTruncated).toBe(false);
    }
  });

  it("returns not-found for archived product or variant ids on this create-path", async () => {
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "id", id: fixtures.archived } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "Old Widget" } }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variantSelection: {
              kind: "reference",
              ref: { by: "id", id: fixtures.variantArchived },
            },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns not-found for a variant query on a simple product, not unmatched_query", async () => {
    const selectionError = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.alpha },
            variantSelection: {
              kind: "reference",
              ref: { by: "query", value: "Lemon" },
            },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (caught: unknown) => caught,
      );
    expect(selectionError).toBeInstanceOf(NotFoundError);
    expect(selectionError).not.toBeInstanceOf(ReferenceResolutionConflictError);

    const legacyError = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.alpha },
            variant: { by: "query", value: "Lemon" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (caught: unknown) => caught,
      );
    expect(legacyError).toBeInstanceOf(NotFoundError);
    expect(legacyError).not.toBeInstanceOf(ReferenceResolutionConflictError);
  });

  it("conflicts on unmatched variant query with active options, not an empty picker", async () => {
    const error = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.coat },
            variantSelection: {
              kind: "reference",
              ref: { by: "query", value: "Vintage" },
            },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const conflict = expectResolutionConflict(error);
    expect(conflict.reason).toBe("unmatched_query");
    expect(conflict.target.lineIndex).toBe(0);
    expect(conflict.target.productId).toBe(fixtures.coat);
    expect(conflict.options).toEqual([
      { id: fixtures.variantBlue, label: "Blue" },
      { id: fixtures.variantRed, label: "Red" },
    ]);
    expect(conflict.optionsTruncated).toBe(false);
  });

  it("conflicts on ambiguous variant names among candidates only", async () => {
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
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const conflict = expectResolutionConflict(error);
    expect(conflict.reason).toBe("ambiguous");
    expect(conflict.options).toEqual([
      { id: fixtures.variantBlue, label: "Blue" },
      { id: fixtures.variantRed, label: "Red" },
    ]);
    expect(conflict.options.map((option) => option.id)).not.toContain(
      fixtures.variantArchived,
    );
  });

  it("uses deterministic input-order lineIndex on the first unresolved variable line", async () => {
    const error = await kit
      .invoke(resolveLineReferences, {
        lines: [
          { product: { by: "id", id: fixtures.alpha } },
          {
            product: { by: "id", id: fixtures.coat },
            variantSelection: { kind: "unspecified" },
          },
          { product: { by: "id", id: fixtures.zero } },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const conflict = expectResolutionConflict(error);
    expect(conflict.reason).toBe("variant_required");
    expect(conflict.target.lineIndex).toBe(1);
    expect(conflict.target.productId).toBe(fixtures.coat);
    expect(conflict.target.productName).toBe("Coat");
  });

  it("fits a six-flavour product in the picker and truncates above the named cap", async () => {
    const six = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.macarons },
            variantSelection: { kind: "unspecified" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const sixConflict = expectResolutionConflict(six);
    expect(sixConflict.options).toHaveLength(6);
    expect(sixConflict.optionsTruncated).toBe(false);
    expect(sixConflict.options.map((option) => option.label)).toEqual([
      "Chocolate",
      "Lemon",
      "Pistachio",
      "Raspberry",
      "Salted Caramel",
      "Vanilla",
    ]);

    const overflowId = randomUUID();
    await insertProduct({
      id: overflowId,
      companyId: kitIdentities.companies.a,
      name: "Overflow Box",
      basePriceMinor: 10n,
    });
    await kit.db.runtime.db.insert(productVariants).values(
      Array.from({ length: VARIANT_SELECTION_OPTIONS_MAX + 1 }, (_, index) => ({
        id: randomUUID(),
        companyId: kitIdentities.companies.a,
        productId: overflowId,
        name: `Flavour ${String(index).padStart(2, "0")}`,
        status: "active" as const,
      })),
    );
    const overflow = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: overflowId },
            variantSelection: { kind: "unspecified" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ReferenceResolutionConflictError");
        },
        (caught: unknown) => caught,
      );
    const overflowConflict = expectResolutionConflict(overflow);
    expect(overflowConflict.options).toHaveLength(
      VARIANT_SELECTION_OPTIONS_MAX,
    );
    expect(overflowConflict.optionsTruncated).toBe(true);
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
    expect(error).not.toBeInstanceOf(ReferenceResolutionConflictError);
    if (!(error instanceof ConflictError)) {
      return;
    }
    expect(error.clientMessage).toContain(
      `TwinCake (UAH, ${fixtures.twinUah})`,
    );
    expect(error.clientMessage).toContain(
      `TwinCake (EUR, ${fixtures.twinEur})`,
    );
  });

  it("conflicts on contains-only product hits and never auto-chooses", async () => {
    await expect(
      kit.invoke(resolveLineReferences, {
        lines: [{ product: { by: "query", value: "Cake" } }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
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

  it("rejects an empty or oversized batch and exclusive variant fields", async () => {
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
    const exclusive = await kit
      .invoke(resolveLineReferences, {
        lines: [
          {
            product: { by: "id", id: fixtures.alpha },
            variant: { by: "id", id: fixtures.variantRed },
            variantSelection: { kind: "base" },
          },
        ],
      })
      .then(
        () => {
          throw new Error("expected ValidationError");
        },
        (caught: unknown) => caught,
      );
    expect(exclusive).toBeInstanceOf(ValidationError);
    if (!(exclusive instanceof ValidationError)) {
      return;
    }
    expect(exclusive.clientMessage).toBe("Input validation failed.");
    expect(JSON.stringify(exclusive.issues)).toContain(
      VARIANT_AND_SELECTION_EXCLUSIVE_MESSAGE,
    );
  });

  it("does not per-line query or ctx.call", () => {
    const source = readFileSync(
      new URL("../services/resolve-line-references.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/ctx\.call\(/);
    // id + exact-name + per-query capped contains + variants for resolved products
    expect(source.match(/\.from\(/g)?.length).toBe(4);
    expect(source).toMatch(/VARIANT_SELECTION_OPTIONS_MAX/);
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
    expect(error).not.toBeInstanceOf(ReferenceResolutionConflictError);
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
    expect(error).not.toBeInstanceOf(ReferenceResolutionConflictError);
    if (!(error instanceof ConflictError)) {
      return;
    }
    const labels = [...error.clientMessage.matchAll(/MatchCap \d/g)];
    expect(labels.length).toBe(5);
    expect(error.clientMessage).not.toContain("MatchCap 5");
  });
});
