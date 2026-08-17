/**
 * fnd-T5A parity-fixture self-tests (db.md §8; core.md §12; ADR-0020). The
 * core suites (fnd-T21/T22) can only detect tenant/publication/collection
 * leaks if the dataset actually contains something to leak. These tests
 * prove the seeded dataset exposes each leak class — published/unpublished,
 * allowlisted/internal, cross-company, private collections — keeps counters
 * exact, and that browsing leaves the CRM sentinel unchanged.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createProjectionReadTx } from "../capabilities.js";
import type { Database } from "../client.js";
import {
  createParityFixtureTables,
  fixtureCompanies,
  fixtureCompanyFollows,
  fixtureCrmCustomers,
  fixtureDiscoveryCompanies,
  fixtureDiscoveryGrant,
  fixtureDiscoveryProducts,
  fixtureProductComments,
  fixtureProductLikes,
  fixtureProducts,
  parityIds,
  readCrmSentinel,
  seedParityFixtures,
} from "./fixtures.js";
import { createTestDatabase, type TestDatabase } from "./harness.js";

let database: TestDatabase;
let db: Database;

beforeAll(async () => {
  database = await createTestDatabase();
  await createParityFixtureTables(database.admin);
  await seedParityFixtures(database.runtime.db);
  db = database.runtime.db;
});

afterAll(async () => {
  await database.close();
});

describe("published/unpublished parity", () => {
  it("seeds two companies and both publication states in the domain tables", async () => {
    const companies = await db.select().from(fixtureCompanies);
    expect(companies).toHaveLength(2);
    expect(
      companies.map((company) => [company.id, company.published]).sort(),
    ).toEqual([
      [parityIds.companies.published, true],
      [parityIds.companies.unpublished, false],
    ]);
  });

  it("keeps unpublished entities out of the discovery projections", async () => {
    const companyRows = await db.select().from(fixtureDiscoveryCompanies);
    expect(companyRows.map((row) => row.companyId)).toEqual([
      parityIds.companies.published,
    ]);
    const productRows = await db.select().from(fixtureDiscoveryProducts);
    expect(productRows.map((row) => row.productId)).toEqual([
      parityIds.products.published,
    ]);
  });

  it("makes a leaky domain-table scan detectable against the known ids", async () => {
    // Simulated bug: a public/consumer read scanning domain tables instead
    // of its projection. The fixture guarantees such a scan returns rows the
    // suites can flag: an unpublished product and a foreign company's
    // product.
    const leakedIds = (await db.select().from(fixtureProducts)).map(
      (row) => row.id,
    );
    expect(leakedIds).toContain(parityIds.products.unpublished);
    expect(leakedIds).toContain(parityIds.products.ofUnpublishedCompany);
    const publishedOnly = new Set<string>([parityIds.products.published]);
    expect(leakedIds.filter((id) => !publishedOnly.has(id))).toHaveLength(2);
  });
});

describe("allowlisted/internal parity", () => {
  it("seeds internal fields so an allowlist violation has something to expose", async () => {
    const [companyRow] = await db.select().from(fixtureDiscoveryCompanies);
    expect(companyRow?.internalNote).toContain("internal");
    const [productRow] = await db.select().from(fixtureDiscoveryProducts);
    expect(productRow?.internalNote).toContain("internal");
  });

  it("excludes the internal columns from the fixture grant allowlist", () => {
    for (const entry of Object.values(fixtureDiscoveryGrant.tables)) {
      expect(Object.keys(entry.columns)).not.toContain("internalNote");
    }
  });
});

describe("private-collection parity (two users)", () => {
  it("gives each user a distinct own collection so leaks are attributable", async () => {
    // Unfiltered reads (the leaky path) surface a foreign user's rows…
    const follows = await db.select().from(fixtureCompanyFollows);
    expect(follows).toEqual([
      {
        userId: parityIds.users.anna,
        companyId: parityIds.companies.published,
      },
    ]);
    const likes = await db.select().from(fixtureProductLikes);
    expect(likes).toEqual([
      {
        userId: parityIds.users.boris,
        productId: parityIds.products.published,
      },
    ]);
    // …while the own-collection path returns nothing for the other user:
    // Boris follows no company, Anna likes no product.
    const borisFollows = await db
      .select()
      .from(fixtureCompanyFollows)
      .where(eq(fixtureCompanyFollows.userId, parityIds.users.boris));
    expect(borisFollows).toEqual([]);
    const annaLikes = await db
      .select()
      .from(fixtureProductLikes)
      .where(eq(fixtureProductLikes.userId, parityIds.users.anna));
    expect(annaLikes).toEqual([]);
  });

  it("threads comments from both users on the published product", async () => {
    const comments = await db
      .select()
      .from(fixtureProductComments)
      .orderBy(fixtureProductComments.id);
    expect(
      comments.map((comment) => [
        comment.id,
        comment.authorUserId,
        comment.parentCommentId,
      ]),
    ).toEqual([
      [parityIds.comments.question, parityIds.users.anna, null],
      [
        parityIds.comments.reply,
        parityIds.users.boris,
        parityIds.comments.question,
      ],
    ]);
  });
});

describe("exact counters", () => {
  it("materializes projection counters that match the seeded collections", async () => {
    const [company] = await db.select().from(fixtureDiscoveryCompanies);
    const follows = await db
      .select()
      .from(fixtureCompanyFollows)
      .where(
        eq(fixtureCompanyFollows.companyId, parityIds.companies.published),
      );
    expect(company?.followerCount).toBe(follows.length);
    const publishedProducts = await db
      .select()
      .from(fixtureProducts)
      .where(eq(fixtureProducts.companyId, parityIds.companies.published));
    expect(company?.productCount).toBe(
      publishedProducts.filter((product) => product.published).length,
    );

    const [product] = await db.select().from(fixtureDiscoveryProducts);
    const likes = await db
      .select()
      .from(fixtureProductLikes)
      .where(eq(fixtureProductLikes.productId, parityIds.products.published));
    expect(product?.likeCount).toBe(likes.length);
    const comments = await db
      .select()
      .from(fixtureProductComments)
      .where(
        eq(fixtureProductComments.productId, parityIds.products.published),
      );
    expect(product?.commentCount).toBe(comments.length);
  });
});

describe("CRM sentinel", () => {
  it("seeds exactly one explicit sentinel row — factories create no CRM rows as a side effect", async () => {
    const rows = await db.select().from(fixtureCrmCustomers);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(parityIds.crmSentinel);
  });

  it("browsing leaves the sentinel unchanged", async () => {
    const before = await readCrmSentinel(db);
    expect(before).toHaveLength(1);
    // Representative anonymous/consumer browse: projection reads through the
    // grant facade in a read-only transaction (ADR-0020: discovery never
    // creates CRM records).
    await db.transaction(
      async (tx) => {
        const projection = createProjectionReadTx(tx, fixtureDiscoveryGrant);
        await projection.from("discoveryCompanies");
        await projection
          .from("discoveryProducts")
          .where(
            eq(
              fixtureDiscoveryProducts.companyId,
              parityIds.companies.published,
            ),
          );
      },
      { accessMode: "read only" },
    );
    const after = await readCrmSentinel(db);
    expect(after).toEqual(before);
  });
});
