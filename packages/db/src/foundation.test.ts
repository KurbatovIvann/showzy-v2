/**
 * fnd-T4 verification (docs/plans/foundation.md): the initial migrations
 * apply cleanly to a fresh Postgres 17, and the foundation tables, indexes,
 * CHECK constraints, roles, and the shared `updated_at` trigger exist exactly
 * as specified in docs/specs/db.md §4–§6. The full template-DB harness and
 * grant/drift CI stages arrive with fnd-T5.
 *
 * Raw SQL below is test-only structure verification (catalog queries, CHECK /
 * unique / grant probes) — it cannot be expressed through the Drizzle query
 * builder and is not a domain data path (db.md §7 keeps domain queries
 * Drizzle-only).
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "./client.js";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

let container: StartedPostgreSqlContainer;
let dbClient: DbClient;
/** Superuser session for catalog assertions and SET ROLE grant probes. */
let admin: pg.Client;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  dbClient = createDbClient({ databaseUrl: container.getConnectionUri() });
  // The core assertion of fnd-T4: all committed migrations apply cleanly to a
  // fresh Postgres 17. Everything below inspects the result.
  await migrate(dbClient.db, { migrationsFolder });
  admin = new pg.Client({ connectionString: container.getConnectionUri() });
  await admin.connect();
});

afterAll(async () => {
  await admin.end();
  await dbClient.pool.end();
  await container.stop();
});

/** Asserts a query fails with the given SQLSTATE (e.g. 23514 check_violation). */
async function expectSqlState(promise: Promise<unknown>, sqlState: string) {
  await expect(promise).rejects.toMatchObject({ code: sqlState });
}

function insert(table: string, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const placeholders = keys.map((_, i) => `$${String(i + 1)}`).join(", ");
  return admin.query(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
    keys.map((key) => row[key]),
  );
}

/** A valid outbox row; overrides let each test target one constraint. */
function domainEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    name: "orders.created",
    version: 1,
    occurred_at: new Date(),
    company_id: randomUUID(),
    aggregate_type: "order",
    aggregate_id: randomUUID(),
    aggregate_sequence: 1,
    actor_type: "user",
    actor_id: randomUUID(),
    channel: "ui",
    request_id: "req-1",
    correlation_id: "corr-1",
    causation_id: "req-1",
    payload: { orderId: randomUUID() },
    ...overrides,
  };
}

function idempotencyKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    principal_key: `staff:${randomUUID()}`,
    scope_key: `company:${randomUUID()}`,
    company_id: randomUUID(),
    action: "orders.create",
    key: randomUUID(),
    request_hash: "a".repeat(64),
    status: "in_progress",
    attempt_id: randomUUID(),
    lease_expires_at: new Date(Date.now() + 30_000),
    expires_at: new Date(Date.now() + 48 * 3_600_000),
    ...overrides,
  };
}

function auditLogRow(overrides: Record<string, unknown> = {}) {
  return {
    request_id: "req-1",
    correlation_id: "corr-1",
    action: "orders.create",
    actor_type: "user",
    actor_id: randomUUID(),
    channel: "ui",
    company_id: randomUUID(),
    target_type: "order",
    target_id: randomUUID(),
    input_hash: "b".repeat(64),
    outcome: "ok",
    duration_ms: 12,
    ...overrides,
  };
}

describe("foundation migrations", () => {
  it("creates the five foundation tables (db.md §4)", async () => {
    const result = await admin.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = result.rows.map(
      (row: { table_name: string }) => row.table_name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "domain_events",
        "event_aggregate_sequences",
        "event_deliveries",
        "idempotency_keys",
        "audit_log",
      ]),
    );
  });

  it("creates every specified index, including the partial undispatched index", async () => {
    const result = await admin.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const indexes = new Map<string, string>(
      result.rows.map((row: { indexname: string; indexdef: string }) => [
        row.indexname,
        row.indexdef,
      ]),
    );
    for (const expected of [
      "domain_events_aggregate_sequence_uq",
      "domain_events_undispatched_idx",
      "domain_events_company_occurred_at_idx",
      "event_deliveries_status_next_attempt_at_idx",
      "event_deliveries_event_id_idx",
      "idempotency_keys_expires_at_idx",
      "idempotency_keys_status_lease_expires_at_idx",
      "idempotency_keys_company_created_at_idx",
      "audit_log_company_created_at_idx",
      "audit_log_actor_created_at_idx",
      "audit_log_action_created_at_idx",
    ]) {
      expect(indexes.has(expected), `missing index ${expected}`).toBe(true);
    }
    expect(indexes.get("domain_events_undispatched_idx")).toContain(
      "WHERE (dispatched_at IS NULL)",
    );
    expect(indexes.get("domain_events_aggregate_sequence_uq")).toContain(
      "UNIQUE",
    );
  });

  it("keeps event ids app-generated and nullable columns exactly per spec", async () => {
    const result = await admin.query(
      `SELECT table_name, column_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN
         ('domain_events', 'event_aggregate_sequences', 'idempotency_keys', 'audit_log')`,
    );
    const byColumn = new Map<
      string,
      { is_nullable: string; column_default: string | null }
    >(
      result.rows.map(
        (row: {
          table_name: string;
          column_name: string;
          is_nullable: string;
          column_default: string | null;
        }) => [`${row.table_name}.${row.column_name}`, row],
      ),
    );
    // Event ids are app-generated UUIDv7 (db.md §3) — no DB default.
    expect(byColumn.get("domain_events.id")?.column_default).toBeNull();
    // company_id is null only for declared global system events / global work.
    expect(byColumn.get("domain_events.company_id")?.is_nullable).toBe("YES");
    expect(
      byColumn.get("event_aggregate_sequences.company_id")?.is_nullable,
    ).toBe("YES");
    expect(byColumn.get("idempotency_keys.company_id")?.is_nullable).toBe(
      "YES",
    );
    expect(byColumn.get("audit_log.company_id")?.is_nullable).toBe("YES");
    // The response snapshot exists only once the attempt completes (core.md §5).
    expect(byColumn.get("idempotency_keys.response")?.is_nullable).toBe("YES");
    expect(byColumn.get("audit_log.id")?.column_default).toContain(
      "gen_random_uuid",
    );
  });
});

describe("domain_events (transactional outbox — ADR-0012)", () => {
  it("accepts a valid tenant event and a global event without company_id", async () => {
    await insert("domain_events", domainEventRow());
    await insert(
      "domain_events",
      domainEventRow({
        company_id: null,
        actor_type: "system",
        channel: "system",
      }),
    );
  });

  it("rejects actor types outside user|system", async () => {
    await expectSqlState(
      insert("domain_events", domainEventRow({ actor_type: "ai" })),
      "23514",
    );
  });

  it("rejects channels outside ui|ai|system|webhook", async () => {
    await expectSqlState(
      insert("domain_events", domainEventRow({ channel: "email" })),
      "23514",
    );
  });

  it("enforces one monotonic sequence slot per aggregate", async () => {
    const aggregateId = randomUUID();
    await insert(
      "domain_events",
      domainEventRow({ aggregate_id: aggregateId, aggregate_sequence: 1 }),
    );
    await expectSqlState(
      insert(
        "domain_events",
        domainEventRow({ aggregate_id: aggregateId, aggregate_sequence: 1 }),
      ),
      "23505",
    );
  });
});

describe("event_aggregate_sequences", () => {
  it("keys sequence state by (aggregate_type, aggregate_id)", async () => {
    const aggregateId = randomUUID();
    await insert("event_aggregate_sequences", {
      aggregate_type: "order",
      aggregate_id: aggregateId,
      company_id: randomUUID(),
      last_sequence: 1,
    });
    await expectSqlState(
      insert("event_aggregate_sequences", {
        aggregate_type: "order",
        aggregate_id: aggregateId,
        company_id: randomUUID(),
        last_sequence: 2,
      }),
      "23505",
    );
  });
});

describe("event_deliveries (per-consumer delivery + dedup — core.md §6)", () => {
  async function insertEvent(): Promise<string> {
    const row = domainEventRow();
    await insert("domain_events", row);
    return row.id;
  }

  it("accepts a pending delivery for an existing event", async () => {
    await insert("event_deliveries", {
      consumer: "chat.order-card-updater",
      event_id: await insertEvent(),
      status: "pending",
      attempts: 0,
    });
  });

  it("rejects statuses outside pending|processing|processed|dead", async () => {
    await expectSqlState(
      insert("event_deliveries", {
        consumer: "chat.order-card-updater",
        event_id: await insertEvent(),
        status: "retrying",
        attempts: 0,
      }),
      "23514",
    );
  });

  it("rejects deliveries pointing at a missing outbox event", async () => {
    await expectSqlState(
      insert("event_deliveries", {
        consumer: "chat.order-card-updater",
        event_id: randomUUID(),
        status: "pending",
        attempts: 0,
      }),
      "23503",
    );
  });

  it("dedups on (consumer, event_id) — redelivery cannot create a second row", async () => {
    const eventId = await insertEvent();
    const row = {
      consumer: "payments.order-payment-creator",
      event_id: eventId,
      status: "pending",
      attempts: 0,
    };
    await insert("event_deliveries", row);
    await expectSqlState(insert("event_deliveries", row), "23505");
    // A different consumer of the same event is a separate delivery.
    await insert("event_deliveries", {
      ...row,
      consumer: "chat.order-card-updater",
    });
  });
});

describe("idempotency_keys (core.md §5)", () => {
  it("accepts an in_progress reservation", async () => {
    await insert("idempotency_keys", idempotencyKeyRow());
  });

  it("rejects statuses outside in_progress|completed|failed", async () => {
    await expectSqlState(
      insert("idempotency_keys", idempotencyKeyRow({ status: "done" })),
      "23514",
    );
  });

  it("is unique per (principal_key, scope_key, action, key) — and only that", async () => {
    const row = idempotencyKeyRow();
    await insert("idempotency_keys", row);
    await expectSqlState(
      insert("idempotency_keys", { ...row, attempt_id: randomUUID() }),
      "23505",
    );
    // Another staff member's identical key is a distinct reservation: one
    // member must not be able to replay another's stored response.
    await insert("idempotency_keys", {
      ...row,
      principal_key: `staff:${randomUUID()}`,
      attempt_id: randomUUID(),
    });
  });
});

describe("audit_log (core.md §8)", () => {
  it("accepts a row and fills id/created_at defaults", async () => {
    await insert("audit_log", auditLogRow());
    const result = await admin.query<{ id: string; created_at: Date }>(
      `SELECT id, created_at FROM audit_log LIMIT 1`,
    );
    expect(result.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("rejects actor types and channels outside their CHECK lists", async () => {
    await expectSqlState(
      insert("audit_log", auditLogRow({ actor_type: "ai" })),
      "23514",
    );
    await expectSqlState(
      insert("audit_log", auditLogRow({ channel: "sms" })),
      "23514",
    );
  });
});

describe("roles (db.md §6)", () => {
  it("creates showzy_app, showzy_migrate, showzy_maintenance without LOGIN", async () => {
    const result = await admin.query(
      `SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE 'showzy_%' ORDER BY rolname`,
    );
    expect(result.rows).toEqual([
      { rolname: "showzy_app", rolcanlogin: false },
      { rolname: "showzy_maintenance", rolcanlogin: false },
      { rolname: "showzy_migrate", rolcanlogin: false },
    ]);
  });

  it("gives the runtime role DML everywhere but keeps audit_log append-only and DDL off", async () => {
    const probe = new pg.Client({
      connectionString: container.getConnectionUri(),
    });
    await probe.connect();
    try {
      await probe.query(`SET ROLE showzy_app`);
      // Ordinary DML is granted (writes on protocol tables).
      await probe.query(
        `UPDATE event_deliveries SET attempts = attempts WHERE consumer = 'none'`,
      );
      // audit_log: INSERT + SELECT only — append-only for the runtime role.
      const inserted = auditLogRow();
      const keys = Object.keys(inserted);
      await probe.query(
        `INSERT INTO audit_log (${keys.join(", ")})
         VALUES (${keys.map((_, i) => `$${String(i + 1)}`).join(", ")})`,
        keys.map((key) => (inserted as Record<string, unknown>)[key]),
      );
      await probe.query(`SELECT count(*) FROM audit_log`);
      await expectSqlState(
        probe.query(`UPDATE audit_log SET outcome = 'x'`),
        "42501",
      );
      await expectSqlState(probe.query(`DELETE FROM audit_log`), "42501");
      await expectSqlState(probe.query(`TRUNCATE audit_log`), "42501");
      // No DDL for the runtime role.
      await expectSqlState(
        probe.query(`CREATE TABLE smuggled (id int)`),
        "42501",
      );
    } finally {
      await probe.end();
    }
  });

  it("lets the maintenance role expire audit rows but nothing broader", async () => {
    const result = await admin.query(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE grantee = 'showzy_maintenance' AND table_name = 'audit_log'
       ORDER BY privilege_type`,
    );
    expect(
      result.rows.map((row: { privilege_type: string }) => row.privilege_type),
    ).toEqual(["DELETE", "SELECT"]);
    const anythingElse = await admin.query(
      `SELECT DISTINCT table_name FROM information_schema.role_table_grants
       WHERE grantee = 'showzy_maintenance' AND table_name <> 'audit_log'`,
    );
    expect(anythingElse.rows).toEqual([]);
  });
});

describe("shared updated_at trigger (db.md §5)", () => {
  it("touches updated_at on UPDATE when a table attaches set_updated_at()", async () => {
    // Scratch table standing in for a future module table; module migrations
    // attach the shared function exactly like this.
    await admin.query(
      `CREATE TABLE trigger_probe (
         id int PRIMARY KEY,
         value text,
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await admin.query(
      `CREATE TRIGGER trigger_probe_set_updated_at
       BEFORE UPDATE ON trigger_probe
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    );
    await admin.query(`INSERT INTO trigger_probe (id, value) VALUES (1, 'a')`);
    const before = await admin.query<{ updated_at: Date }>(
      `SELECT updated_at FROM trigger_probe WHERE id = 1`,
    );
    await admin.query(`SELECT pg_sleep(0.05)`);
    await admin.query(`UPDATE trigger_probe SET value = 'b' WHERE id = 1`);
    const after = await admin.query<{ updated_at: Date }>(
      `SELECT updated_at FROM trigger_probe WHERE id = 1`,
    );
    expect(after.rows[0]?.updated_at.getTime()).toBeGreaterThan(
      before.rows[0]?.updated_at.getTime() ?? Number.POSITIVE_INFINITY,
    );
  });
});
