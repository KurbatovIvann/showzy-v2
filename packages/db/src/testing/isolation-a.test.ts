import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "./harness.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.close();
});

it("isolates test file A in its own template clone", async () => {
  await database.runtime.pool.query(
    `INSERT INTO audit_log
      (request_id, correlation_id, action, actor_type, actor_id, channel,
       target_type, target_id, input_hash, outcome, duration_ms)
     VALUES ($1, $1, 'testing.probe', 'user', $2, 'system',
       'probe', $3, $4, 'ok', 1)`,
    ["isolation-a", randomUUID(), randomUUID(), "a".repeat(64)],
  );

  const result = await database.runtime.pool.query<{ request_id: string }>(
    `SELECT request_id FROM audit_log`,
  );
  expect(result.rows).toEqual([{ request_id: "isolation-a" }]);
});
