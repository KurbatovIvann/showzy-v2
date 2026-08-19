/**
 * Pipeline-level proof that share writes (fnd-T11B) persist the hashed
 * principal key, remap durable actors to system/share, and keep access
 * logs anonymous without the raw capability token (core.md §3/§5/§8).
 */
import { randomUUID } from "node:crypto";

import { auditLog, domainEvents, idempotencyKeys } from "@showzy/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SHARE_DURABLE_ACTOR } from "../runtime/context/types.js";
import { createCorrectFixtureActions } from "./fixture-actions.js";
import { kitIdentities } from "./identities.js";
import { createCapturingLogger, createTestKit, type TestKit } from "./kit.js";
import {
  hashShareToken,
  kitShareDocuments,
  kitShareTokens,
} from "./share-fixture.js";

let kit: TestKit;
const correct = createCorrectFixtureActions();
const shareInput = {
  token: kitShareTokens.a,
  documentId: kitShareDocuments.a.id,
};

beforeAll(async () => {
  kit = await createTestKit();
});

afterAll(async () => {
  await kit.db.close();
});

describe("share principal — durable identity (core.md §5/§8)", () => {
  it("stores share:<sha256> on the idempotency row and system/share on audit and events", async () => {
    const capturing = createCapturingLogger();
    const requestId = randomUUID();
    const expectedHash = hashShareToken(kitShareTokens.a);

    await kit.invoke(
      correct.shareSubmitSignature,
      shareInput,
      {},
      {
        deps: { ...kit.pipeline, logger: capturing.logger },
        request: { requestId },
      },
    );

    const [idempotencyRow] = await kit.db.runtime.db
      .select({
        principalKey: idempotencyKeys.principalKey,
        scopeKey: idempotencyKeys.scopeKey,
        companyId: idempotencyKeys.companyId,
      })
      .from(idempotencyKeys)
      .where(
        eq(idempotencyKeys.action, correct.shareSubmitSignature.contract.name),
      );
    expect(idempotencyRow?.principalKey).toBe(`share:${expectedHash}`);
    expect(idempotencyRow?.principalKey).not.toContain(kitShareTokens.a);
    expect(idempotencyRow?.scopeKey).toBe(
      `company:${kitIdentities.companies.a}`,
    );
    expect(idempotencyRow?.companyId).toBe(kitIdentities.companies.a);

    const [auditRow] = await kit.db.runtime.db
      .select({
        actorType: auditLog.actorType,
        actorId: auditLog.actorId,
        inputSnapshot: auditLog.inputSnapshot,
      })
      .from(auditLog)
      .where(eq(auditLog.requestId, requestId));
    expect(auditRow?.actorType).toBe(SHARE_DURABLE_ACTOR.type);
    expect(auditRow?.actorId).toBe(SHARE_DURABLE_ACTOR.id);
    expect(JSON.stringify(auditRow?.inputSnapshot)).not.toContain(
      kitShareTokens.a,
    );

    const eventRows = await kit.db.runtime.db
      .select({
        actorType: domainEvents.actorType,
        actorId: domainEvents.actorId,
        payload: domainEvents.payload,
      })
      .from(domainEvents)
      .where(eq(domainEvents.requestId, requestId));
    expect(eventRows.length).toBeGreaterThan(0);
    for (const row of eventRows) {
      expect(row.actorType).toBe(SHARE_DURABLE_ACTOR.type);
      expect(row.actorId).toBe(SHARE_DURABLE_ACTOR.id);
      expect(JSON.stringify(row.payload)).not.toContain(kitShareTokens.a);
    }

    const finished = capturing
      .entries()
      .find((line) => line["msg"] === "action finished");
    expect(finished).toMatchObject({
      actor_type: "anonymous",
      actor_id: "anonymous",
    });
    expect(JSON.stringify(capturing.entries())).not.toContain(kitShareTokens.a);
  });
});
