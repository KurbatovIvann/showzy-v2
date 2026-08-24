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
import {
  productMedia,
  products,
  productVariants,
} from "@showzy/db/schema/catalog";
import { companyMembers } from "@showzy/db/schema/companies";
import { files } from "@showzy/db/schema/files";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listProducts } from "./list-products.js";
import {
  formatListProductsCursor,
  LIST_PRODUCTS_MAX_LIMIT,
} from "./list-products.contract.js";

const fixtures = {
  alpha: randomUUID(),
  beta: randomUUID(),
  gamma: randomUUID(),
  archived: randomUUID(),
  foreign: randomUUID(),
  variantAlphaLive: randomUUID(),
  variantAlphaArchived: randomUUID(),
  filePrimary: randomUUID(),
  fileSecond: randomUUID(),
  mediaPrimary: randomUUID(),
  mediaSecond: randomUUID(),
};

const clerkUserId = randomUUID();

let kit: TestKit;

async function insertProduct(values: {
  id: string;
  companyId: string;
  name: string;
  basePriceMinor: bigint;
  status?: "active" | "archived";
  createdAt: Date;
}): Promise<void> {
  await kit.db.runtime.db.insert(products).values({
    id: values.id,
    companyId: values.companyId,
    name: values.name,
    basePriceMinor: values.basePriceMinor,
    status: values.status,
    createdAt: values.createdAt,
    updatedAt: values.createdAt,
  });
}

async function insertVariant(values: {
  id: string;
  companyId: string;
  productId: string;
  name: string;
  status?: "active" | "archived";
}): Promise<void> {
  await kit.db.runtime.db.insert(productVariants).values({
    id: values.id,
    companyId: values.companyId,
    productId: values.productId,
    name: values.name,
    status: values.status,
  });
}

async function insertFile(values: {
  id: string;
  companyId: string;
}): Promise<void> {
  await kit.db.runtime.db.insert(files).values({
    id: values.id,
    companyId: values.companyId,
    uploadedByUserId: kitIdentities.users.anna,
    purpose: "catalog",
    objectKey: `${values.companyId}/catalog/${values.id}`,
    mimeType: "image/jpeg",
    byteSize: 128n,
    checksumSha256: "11".repeat(32),
    status: "ready",
  });
}

beforeAll(async () => {
  kit = await createTestKit();

  await insertProduct({
    id: fixtures.archived,
    companyId: kitIdentities.companies.a,
    name: "Old Thing",
    basePriceMinor: 100n,
    status: "archived",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  await insertProduct({
    id: fixtures.beta,
    companyId: kitIdentities.companies.a,
    name: "Beta Bread",
    basePriceMinor: 200n,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
  });
  await insertProduct({
    id: fixtures.alpha,
    companyId: kitIdentities.companies.a,
    name: "Alpha Cake",
    basePriceMinor: 1500n,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  });
  await insertProduct({
    id: fixtures.gamma,
    companyId: kitIdentities.companies.a,
    name: "Gamma Garnish",
    basePriceMinor: 300n,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
  });
  await insertProduct({
    id: fixtures.foreign,
    companyId: kitIdentities.companies.b,
    name: "Alpha Foreign",
    basePriceMinor: 999n,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  });

  await insertVariant({
    id: fixtures.variantAlphaLive,
    companyId: kitIdentities.companies.a,
    productId: fixtures.alpha,
    name: "Live",
  });
  await insertVariant({
    id: fixtures.variantAlphaArchived,
    companyId: kitIdentities.companies.a,
    productId: fixtures.alpha,
    name: "Archived",
    status: "archived",
  });

  await insertFile({
    id: fixtures.filePrimary,
    companyId: kitIdentities.companies.a,
  });
  await insertFile({
    id: fixtures.fileSecond,
    companyId: kitIdentities.companies.a,
  });
  await kit.db.runtime.db.insert(productMedia).values([
    {
      id: fixtures.mediaSecond,
      companyId: kitIdentities.companies.a,
      productId: fixtures.alpha,
      fileId: fixtures.fileSecond,
      position: 1,
    },
    {
      id: fixtures.mediaPrimary,
      companyId: kitIdentities.companies.a,
      productId: fixtures.alpha,
      fileId: fixtures.filePrimary,
      position: 0,
    },
  ]);

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@catalog-list-kit.test",
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
      listProducts,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("catalog.listProducts", () => {
  it("lists active products newest-first with variant counts and primary image", async () => {
    const result = await kit.invoke(listProducts, {});

    expect(result.items.map((row) => row.id)).toEqual([
      fixtures.gamma,
      fixtures.alpha,
      fixtures.beta,
    ]);
    expect(result.nextCursor).toBeNull();

    const alpha = result.items.find((row) => row.id === fixtures.alpha);
    expect(alpha).toEqual({
      id: fixtures.alpha,
      name: "Alpha Cake",
      basePriceMinor: "1500",
      currency: "UAH",
      status: "active",
      variantCount: 2,
      primaryImageFileId: fixtures.filePrimary,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });

    const beta = result.items.find((row) => row.id === fixtures.beta);
    expect(beta?.variantCount).toBe(0);
    expect(beta?.primaryImageFileId).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/https?:\/\//);
    expect(JSON.stringify(result)).not.toContain("/catalog/");
  });

  it("filters archived and all, and searches names case-insensitively", async () => {
    const archived = await kit.invoke(listProducts, { status: "archived" });
    expect(archived.items.map((row) => row.id)).toEqual([fixtures.archived]);
    expect(archived.items[0]?.status).toBe("archived");

    const all = await kit.invoke(listProducts, { status: "all" });
    expect(all.items.map((row) => row.id)).toEqual([
      fixtures.gamma,
      fixtures.alpha,
      fixtures.beta,
      fixtures.archived,
    ]);

    const search = await kit.invoke(listProducts, { query: "aLpHa" });
    expect(search.items.map((row) => row.id)).toEqual([fixtures.alpha]);
    expect(search.items.map((row) => row.id)).not.toContain(fixtures.foreign);
  });

  it("paginates on createdAt/id and stops at the last page", async () => {
    const first = await kit.invoke(listProducts, { limit: 2 });
    expect(first.items.map((row) => row.id)).toEqual([
      fixtures.gamma,
      fixtures.alpha,
    ]);
    expect(first.nextCursor).toBe(
      formatListProductsCursor(
        new Date("2026-03-01T00:00:00.000Z"),
        fixtures.alpha,
      ),
    );

    const second = await kit.invoke(listProducts, {
      limit: 2,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.id)).toEqual([fixtures.beta]);
    expect(second.nextCursor).toBeNull();
  });

  it("does not include another company's products", async () => {
    const result = await kit.invoke(listProducts, {
      status: "all",
      query: "Alpha",
    });
    expect(result.items.map((row) => row.id)).toEqual([fixtures.alpha]);
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(fixtures.foreign);
    expect(blob).not.toContain(kitIdentities.companies.b);
  });

  it("denies staff without products:view", async () => {
    await expect(
      kit.invoke(
        listProducts,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a bad cursor, oversized limit, and empty query", async () => {
    await expect(
      kit.invoke(listProducts, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listProducts, { limit: LIST_PRODUCTS_MAX_LIMIT + 1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(kit.invoke(listProducts, { limit: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );

    await expect(
      kit.invoke(listProducts, { query: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns an empty page when the search is only LIKE wildcards", async () => {
    const result = await kit.invoke(listProducts, { query: "%%" });
    expect(result).toEqual({ items: [], nextCursor: null });
  });
});
