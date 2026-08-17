/**
 * Discovery/social parity fixtures for the core test suites (fnd-T5A —
 * db.md §8; core.md §12; ADR-0020). Test-only and never runtime-exported:
 * these tables exist only in test databases (created by
 * `createParityFixtureTables`, not by migrations) and this module is
 * reachable only through the `@showzy/db/testing/fixtures` subpath.
 *
 * The dataset is deterministic (fixed UUIDs) and deliberately contains
 * everything a leaky implementation could expose, so the inherited suites
 * (crossTenantSuite, publicProjectionSuite, consumerIsolationSuite,
 * accountIsolationSuite — core.md §12) fail on seeded violations:
 *
 * - two companies, one published and one not, each with internal fields;
 * - published and unpublished products, plus a published product that
 *   belongs to the unpublished company (cross-company bait);
 * - two users with disjoint private collections (Anna follows, Boris
 *   likes) and a comment thread from both;
 * - discovery projections restricted to published entities, carrying exact
 *   counters and an internal column the grant allowlist must hide;
 * - a CRM sentinel row that browsing must never create, change, or delete
 *   (ADR-0020: discovery and social reads create no `company_customers`).
 */
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import type pg from "pg";

import { defineProjectionGrant } from "../capabilities.js";
import type { Database } from "../client.js";

// --- Domain-shaped fixture tables -----------------------------------------

export const fixtureUsers = pgTable("fixture_users", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
});

export const fixtureCompanies = pgTable("fixture_companies", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  published: boolean("published").notNull(),
  /** Never allowlisted — present so an allowlist violation is observable. */
  internalNote: text("internal_note"),
});

export const fixtureProducts = pgTable("fixture_products", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  published: boolean("published").notNull(),
  internalNote: text("internal_note"),
});

/** Own-user private collection (ADR-0020: no public follower lists). */
export const fixtureCompanyFollows = pgTable(
  "fixture_company_follows",
  {
    userId: uuid("user_id").notNull(),
    companyId: uuid("company_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "fixture_company_follows_pk",
      columns: [table.userId, table.companyId],
    }),
  ],
);

/** Own-user private collection (ADR-0020: no public liker lists). */
export const fixtureProductLikes = pgTable(
  "fixture_product_likes",
  {
    userId: uuid("user_id").notNull(),
    productId: uuid("product_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "fixture_product_likes_pk",
      columns: [table.userId, table.productId],
    }),
  ],
);

export const fixtureProductComments = pgTable("fixture_product_comments", {
  id: uuid("id").primaryKey(),
  productId: uuid("product_id").notNull(),
  authorUserId: uuid("author_user_id").notNull(),
  parentCommentId: uuid("parent_comment_id"),
  body: text("body").notNull(),
});

/**
 * The CRM sentinel table. Suites snapshot it before and after browsing and
 * assert deep equality — discovery, social reads, and social mutations must
 * never create CRM rows as a side effect (db.md §8, ADR-0020).
 */
export const fixtureCrmCustomers = pgTable("fixture_crm_customers", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id"),
  displayName: text("display_name").notNull(),
});

// --- Discovery projection fixture tables (the granted surface) ------------

export const fixtureDiscoveryCompanies = pgTable(
  "fixture_discovery_companies",
  {
    companyId: uuid("company_id").primaryKey(),
    name: text("name").notNull(),
    followerCount: integer("follower_count").notNull(),
    productCount: integer("product_count").notNull(),
    internalNote: text("internal_note"),
  },
);

export const fixtureDiscoveryProducts = pgTable("fixture_discovery_products", {
  productId: uuid("product_id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  likeCount: integer("like_count").notNull(),
  commentCount: integer("comment_count").notNull(),
  internalNote: text("internal_note"),
});

/**
 * The projection grant the core suites bind public-global fixture actions
 * to. `internalNote` is deliberately absent from both allowlists — the
 * allowlist tests depend on it staying out.
 */
export const fixtureDiscoveryGrant = defineProjectionGrant({
  id: "fixture.discovery",
  owner: "testing",
  tables: {
    discoveryCompanies: {
      table: fixtureDiscoveryCompanies,
      columns: {
        companyId: fixtureDiscoveryCompanies.companyId,
        name: fixtureDiscoveryCompanies.name,
        followerCount: fixtureDiscoveryCompanies.followerCount,
        productCount: fixtureDiscoveryCompanies.productCount,
      },
    },
    discoveryProducts: {
      table: fixtureDiscoveryProducts,
      columns: {
        productId: fixtureDiscoveryProducts.productId,
        companyId: fixtureDiscoveryProducts.companyId,
        name: fixtureDiscoveryProducts.name,
        likeCount: fixtureDiscoveryProducts.likeCount,
        commentCount: fixtureDiscoveryProducts.commentCount,
      },
    },
  },
});

// --- Deterministic dataset -------------------------------------------------

/** Fixed UUIDs so every suite can name the exact row a leak came from. */
export const parityIds = {
  users: {
    anna: "00000000-0000-4000-8000-00000000a001",
    boris: "00000000-0000-4000-8000-00000000a002",
  },
  companies: {
    published: "00000000-0000-4000-8000-00000000c001",
    unpublished: "00000000-0000-4000-8000-00000000c002",
  },
  products: {
    /** Published product of the published company — the only discoverable one. */
    published: "00000000-0000-4000-8000-00000000d001",
    /** Unpublished product of the published company. */
    unpublished: "00000000-0000-4000-8000-00000000d002",
    /** Published product of the unpublished company (cross-company bait). */
    ofUnpublishedCompany: "00000000-0000-4000-8000-00000000d003",
  },
  comments: {
    question: "00000000-0000-4000-8000-00000000e001",
    reply: "00000000-0000-4000-8000-00000000e002",
  },
  crmSentinel: "00000000-0000-4000-8000-00000000f001",
} as const;

/**
 * Creates the fixture tables in one test database. Raw DDL is test-only
 * structure owned by the harness (db.md §8), mirroring the Drizzle
 * definitions above — fixture tables are intentionally outside migrations
 * and the drift check. The runtime role inherits DML through the
 * ALTER DEFAULT PRIVILEGES of migration 0001 (same creator role in tests).
 */
export async function createParityFixtureTables(
  admin: pg.Client,
): Promise<void> {
  await admin.query(`
    CREATE TABLE fixture_users (
      id uuid PRIMARY KEY,
      display_name text NOT NULL
    );
    CREATE TABLE fixture_companies (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      published boolean NOT NULL,
      internal_note text
    );
    CREATE TABLE fixture_products (
      id uuid PRIMARY KEY,
      company_id uuid NOT NULL,
      name text NOT NULL,
      published boolean NOT NULL,
      internal_note text
    );
    CREATE TABLE fixture_company_follows (
      user_id uuid NOT NULL,
      company_id uuid NOT NULL,
      CONSTRAINT fixture_company_follows_pk PRIMARY KEY (user_id, company_id)
    );
    CREATE TABLE fixture_product_likes (
      user_id uuid NOT NULL,
      product_id uuid NOT NULL,
      CONSTRAINT fixture_product_likes_pk PRIMARY KEY (user_id, product_id)
    );
    CREATE TABLE fixture_product_comments (
      id uuid PRIMARY KEY,
      product_id uuid NOT NULL,
      author_user_id uuid NOT NULL,
      parent_comment_id uuid,
      body text NOT NULL
    );
    CREATE TABLE fixture_crm_customers (
      id uuid PRIMARY KEY,
      company_id uuid NOT NULL,
      user_id uuid,
      display_name text NOT NULL
    );
    CREATE TABLE fixture_discovery_companies (
      company_id uuid PRIMARY KEY,
      name text NOT NULL,
      follower_count integer NOT NULL,
      product_count integer NOT NULL,
      internal_note text
    );
    CREATE TABLE fixture_discovery_products (
      product_id uuid PRIMARY KEY,
      company_id uuid NOT NULL,
      name text NOT NULL,
      like_count integer NOT NULL,
      comment_count integer NOT NULL,
      internal_note text
    );
  `);
}

/**
 * Seeds the deterministic parity dataset. Projection counters are exact by
 * construction: follower/like/comment counts equal the seeded collection
 * rows, and only published entities of published companies appear in the
 * discovery projections. The single CRM row is the explicit sentinel — the
 * factory creates no CRM rows as a side effect of anything else (db.md §8).
 */
export async function seedParityFixtures(db: Database): Promise<void> {
  await db.insert(fixtureUsers).values([
    { id: parityIds.users.anna, displayName: "Anna" },
    { id: parityIds.users.boris, displayName: "Boris" },
  ]);
  await db.insert(fixtureCompanies).values([
    {
      id: parityIds.companies.published,
      name: "Konditerska Anna",
      published: true,
      internalNote: "internal: owner contact and payout details",
    },
    {
      id: parityIds.companies.unpublished,
      name: "Maisternya Boris",
      published: false,
      internalNote: "internal: onboarding draft notes",
    },
  ]);
  await db.insert(fixtureProducts).values([
    {
      id: parityIds.products.published,
      companyId: parityIds.companies.published,
      name: "Honey cake",
      published: true,
      internalNote: "internal: supplier cost",
    },
    {
      id: parityIds.products.unpublished,
      companyId: parityIds.companies.published,
      name: "Draft cheesecake",
      published: false,
      internalNote: "internal: unreleased recipe",
    },
    {
      id: parityIds.products.ofUnpublishedCompany,
      companyId: parityIds.companies.unpublished,
      name: "Hidden workshop chair",
      published: true,
      internalNote: "internal: prototype",
    },
  ]);
  // Disjoint private collections: Anna only follows, Boris only likes —
  // any row of one user surfacing in the other's collection is attributable.
  await db.insert(fixtureCompanyFollows).values([
    {
      userId: parityIds.users.anna,
      companyId: parityIds.companies.published,
    },
  ]);
  await db.insert(fixtureProductLikes).values([
    {
      userId: parityIds.users.boris,
      productId: parityIds.products.published,
    },
  ]);
  await db.insert(fixtureProductComments).values([
    {
      id: parityIds.comments.question,
      productId: parityIds.products.published,
      authorUserId: parityIds.users.anna,
      parentCommentId: null,
      body: "Is the honey cake gluten free?",
    },
    {
      id: parityIds.comments.reply,
      productId: parityIds.products.published,
      authorUserId: parityIds.users.boris,
      parentCommentId: parityIds.comments.question,
      body: "Asking the same!",
    },
  ]);
  await db.insert(fixtureCrmCustomers).values([
    {
      id: parityIds.crmSentinel,
      companyId: parityIds.companies.published,
      userId: parityIds.users.boris,
      displayName: "Boris (CRM sentinel)",
    },
  ]);
  await db.insert(fixtureDiscoveryCompanies).values([
    {
      companyId: parityIds.companies.published,
      name: "Konditerska Anna",
      followerCount: 1,
      productCount: 1,
      internalNote: "internal: ranking debug signals",
    },
  ]);
  await db.insert(fixtureDiscoveryProducts).values([
    {
      productId: parityIds.products.published,
      companyId: parityIds.companies.published,
      name: "Honey cake",
      likeCount: 1,
      commentCount: 2,
      internalNote: "internal: ranking debug signals",
    },
  ]);
}

/**
 * Ordered CRM sentinel snapshot. Suites take it before and after the
 * behavior under test and assert deep equality.
 */
export async function readCrmSentinel(db: Database) {
  return db.select().from(fixtureCrmCustomers).orderBy(fixtureCrmCustomers.id);
}
