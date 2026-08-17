/**
 * fnd-T5A capability facades (db.md §3 "Transaction capabilities", §10;
 * core.md §2–§4; ADR-0020). Two layers are verified:
 *
 * - compile level — `expectTypeOf` assertions fail `tsc --noEmit` if a
 *   mutation member appears on `ReadTx`/`ProjectionReadTx` or a foreign
 *   table name becomes acceptable to the projection facade;
 * - execute level — against a real template-copy database: the facades carry
 *   no write members at runtime, granted reads return exactly the
 *   allowlisted fields, and non-granted tables are rejected with the typed
 *   violation error.
 */
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";

import {
  assertGrantedTable,
  createProjectionGrantManifest,
  createProjectionReadTx,
  createReadTx,
  defineProjectionGrant,
  ProjectionGrantViolationError,
  projectionGrants,
  type GrantedSelect,
  type ProjectionReadTx,
  type ReadTx,
  type Tx,
} from "./capabilities.js";
import { auditLog } from "./schema/foundation.js";
import {
  createParityFixtureTables,
  fixtureDiscoveryCompanies,
  fixtureDiscoveryGrant,
  fixtureDiscoveryProducts,
  parityIds,
  seedParityFixtures,
} from "./testing/fixtures.js";
import { createTestDatabase, type TestDatabase } from "./testing/harness.js";

type FixtureGrant = typeof fixtureDiscoveryGrant;

const writeMembers = [
  "insert",
  "update",
  "delete",
  "execute",
  "transaction",
  "rollback",
] as const;

describe("ReadTx (compile level)", () => {
  it("omits every mutation and transaction-control member", () => {
    expectTypeOf<ReadTx>().toHaveProperty("select");
    expectTypeOf<ReadTx>().not.toHaveProperty("insert");
    expectTypeOf<ReadTx>().not.toHaveProperty("update");
    expectTypeOf<ReadTx>().not.toHaveProperty("delete");
    expectTypeOf<ReadTx>().not.toHaveProperty("execute");
    expectTypeOf<ReadTx>().not.toHaveProperty("transaction");
    expectTypeOf<ReadTx>().not.toHaveProperty("rollback");
  });

  it("is satisfied by a full Tx, so core can hand callees a narrowed view", () => {
    expectTypeOf<Tx>().toExtend<ReadTx>();
  });
});

describe("ProjectionReadTx (compile level)", () => {
  it("accepts only granted table names in from()", () => {
    expectTypeOf<
      Parameters<ProjectionReadTx<FixtureGrant>["from"]>[0]
    >().toEqualTypeOf<"discoveryCompanies" | "discoveryProducts">();
  });

  it("exposes neither mutations nor arbitrary-table select", () => {
    expectTypeOf<ProjectionReadTx<FixtureGrant>>().not.toHaveProperty("insert");
    expectTypeOf<ProjectionReadTx<FixtureGrant>>().not.toHaveProperty("update");
    expectTypeOf<ProjectionReadTx<FixtureGrant>>().not.toHaveProperty("delete");
    expectTypeOf<ProjectionReadTx<FixtureGrant>>().not.toHaveProperty(
      "execute",
    );
    expectTypeOf<ProjectionReadTx<FixtureGrant>>().not.toHaveProperty("select");
  });

  it("types rows to the allowlist only — the internal column cannot leak", () => {
    type CompanyRow = Awaited<
      GrantedSelect<FixtureGrant["tables"]["discoveryCompanies"]>
    >[number];
    expectTypeOf<CompanyRow>().toHaveProperty("companyId");
    expectTypeOf<CompanyRow>().toHaveProperty("followerCount");
    expectTypeOf<CompanyRow>().not.toHaveProperty("internalNote");
  });
});

describe("projection grant manifest", () => {
  it("rejects an allowlisted column that does not belong to the granted table", () => {
    expect(() =>
      defineProjectionGrant({
        id: "fixture.invalid",
        owner: "testing",
        tables: {
          discoveryCompanies: {
            table: fixtureDiscoveryCompanies,
            // The type system cannot see this mismatch (any PgColumn is a
            // valid allowlist entry); the define-time check must.
            columns: { name: fixtureDiscoveryProducts.name },
          },
        },
      }),
    ).toThrow(ProjectionGrantViolationError);
  });

  it("rejects duplicate grant ids", () => {
    expect(() =>
      createProjectionGrantManifest([
        fixtureDiscoveryGrant,
        fixtureDiscoveryGrant,
      ]),
    ).toThrow(ProjectionGrantViolationError);
  });

  it("starts empty at runtime — grants register with their owning module schema tasks", () => {
    expect(projectionGrants.size).toBe(0);
  });
});

describe("capabilities against the database", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await createParityFixtureTables(database.admin);
    await seedParityFixtures(database.runtime.db);
  });

  afterAll(async () => {
    await database.close();
  });

  it("createReadTx serves reads and carries no write member at runtime", async () => {
    await database.runtime.db.transaction(async (tx) => {
      const readTx = createReadTx(tx);
      const rows = await readTx.select().from(auditLog);
      expect(rows).toEqual([]);
      for (const member of writeMembers) {
        expect(readTx, `ReadTx must not expose ${member}`).not.toHaveProperty(
          member,
        );
      }
    });
  });

  it("keeps working inside the read-only transaction mode core uses for risk: read", async () => {
    await database.runtime.db.transaction(
      async (tx) => {
        const readTx = createReadTx(tx);
        const companies = await readTx.select().from(fixtureDiscoveryCompanies);
        expect(companies).toHaveLength(1);
        // Layered defense below the facade: even a smuggled write on the
        // underlying transaction fails at the database with SQLSTATE 25006
        // (read_only_sql_transaction), surfaced on DrizzleQueryError.cause.
        await expect(
          tx.delete(fixtureDiscoveryCompanies),
        ).rejects.toMatchObject({ cause: { code: "25006" } });
      },
      { accessMode: "read only" },
    );
  });

  it("serves granted tables with exactly the allowlisted fields", async () => {
    await database.runtime.db.transaction(async (tx) => {
      const projection = createProjectionReadTx(tx, fixtureDiscoveryGrant);
      expect(projection.grantId).toBe("fixture.discovery");
      const companies = await projection.from("discoveryCompanies");
      expect(companies).toHaveLength(1);
      expect(Object.keys(companies[0] ?? {}).sort()).toEqual([
        "companyId",
        "followerCount",
        "name",
        "productCount",
      ]);
      expect(companies[0]?.companyId).toBe(parityIds.companies.published);
    });
  });

  it("supports dynamic filtering on the granted selection", async () => {
    await database.runtime.db.transaction(async (tx) => {
      const projection = createProjectionReadTx(tx, fixtureDiscoveryGrant);
      const products = await projection
        .from("discoveryProducts")
        .where(
          eq(fixtureDiscoveryProducts.companyId, parityIds.companies.published),
        )
        .limit(10);
      expect(products.map((product) => product.productId)).toEqual([
        parityIds.products.published,
      ]);
    });
  });

  it("rejects tables outside the grant at runtime with the typed error", () => {
    // The base client satisfies the read capability the facade needs — no
    // transaction required to inspect its surface.
    const projection = createProjectionReadTx(
      database.runtime.db,
      fixtureDiscoveryGrant,
    );
    for (const member of writeMembers) {
      expect(
        projection,
        `ProjectionReadTx must not expose ${member}`,
      ).not.toHaveProperty(member);
    }
    // Grants never authorize source domain tables or foreign projections
    // (db.md §3); the facade's runtime guard backs the compile-time key
    // union for anything that sidesteps the type system.
    for (const foreign of ["fixtureCrmCustomers", "auditLog", "audit_log"]) {
      expect(() => assertGrantedTable(fixtureDiscoveryGrant, foreign)).toThrow(
        ProjectionGrantViolationError,
      );
    }
  });
});
