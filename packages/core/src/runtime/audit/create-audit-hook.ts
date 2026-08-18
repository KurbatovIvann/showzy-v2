/**
 * `createAuditHook` — the fnd-T13 audit protocol implementation (core.md §8).
 *
 * Inserts one `audit_log` row per audited action execution:
 * - **Success (mutations):** inside the handler transaction — atomically with effects.
 * - **Success (reads):** the pipeline calls this in a separate post-commit
 *   transaction; the hook itself is transaction-agnostic.
 * - **Failure / permission denial:** in its own short transaction after
 *   rollback; receives whatever identity the pipeline established.
 *
 * `inputHash` is always the SHA-256 of the RFC 8785 canonical JSON of the
 * validated input. `inputSnapshot` is populated only when the action binds
 * an `auditSnapshot` callback (hash-only is the default).
 */
import { auditLog, type Database, type Tx } from "@showzy/db";

import { effectiveCompanyId } from "../context/factories.js";
import type { ActionActor, ActionChannel } from "../context/types.js";
import type { AuditTargetEnv, AuditTargetRef, JsonValue } from "../types.js";
import type { AuditHook, PreflightAuthorization, PrincipalInvocation } from "../pipeline/types.js";
import { canonicalJsonSha256, type JsonSerializable } from "./canonical-json.js";

export interface AuditHookDeps {
  readonly db: Database;
}

export function createAuditHook(deps: AuditHookDeps): AuditHook {
  return {
    async recordSuccess(env) {
      const targetEnv: AuditTargetEnv = {
        input: env.input,
        output: env.output,
        ctx: env.ctx,
      };
      const target = await env.auditTarget(targetEnv);
      const inputHash = hashInput(env.input);
      const snapshot = env.auditSnapshot
        ? env.auditSnapshot(env.input)
        : undefined;

      await insertAuditRow(env.tx, {
        requestId: env.ctx.requestId,
        correlationId: env.ctx.correlationId,
        action: env.contract.name,
        actorType: env.ctx.actor.type as "user" | "system",
        actorId: env.ctx.actor.id,
        channel: env.ctx.channel,
        aiTraceId: env.ctx.aiTraceId,
        toolCallId: env.ctx.toolCallId,
        companyId: effectiveCompanyId(env.ctx),
        target,
        inputHash,
        inputSnapshot: snapshot ?? null,
        outcome: "ok",
        durationMs: env.durationMs,
      });
    },

    async recordFailure(env) {
      if (env.input === undefined) return;

      const identity = resolveFailureIdentity(env.principal, env.authorization);

      let target: AuditTargetRef | undefined;
      if (env.auditTarget !== undefined) {
        try {
          const targetEnv: AuditTargetEnv = { input: env.input };
          target = await env.auditTarget(targetEnv);
        } catch {
          // If the target callback fails during failure recording, we still
          // need the audit row — use a synthetic target.
        }
      }

      const inputHash = hashInput(env.input);

      await deps.db.transaction(async (tx) => {
        await insertAuditRow(tx, {
          requestId: env.request.requestId,
          correlationId: env.request.correlationId,
          action: env.contract.name,
          actorType: identity.actorType,
          actorId: identity.actorId,
          channel: env.request.channel,
          aiTraceId: env.request.aiTraceId,
          toolCallId: env.request.toolCallId,
          companyId: identity.companyId,
          target: target ?? { type: "unknown", id: "unknown" },
          inputHash,
          inputSnapshot: null,
          outcome: env.error.code,
          durationMs: env.durationMs,
        });
      });
    },
  };
}

interface AuditRowInput {
  readonly requestId: string;
  readonly correlationId: string;
  readonly action: string;
  readonly actorType: "user" | "system";
  readonly actorId: string;
  readonly channel: ActionChannel;
  readonly aiTraceId: string | undefined;
  readonly toolCallId: string | undefined;
  readonly companyId: string | null;
  readonly target: AuditTargetRef;
  readonly inputHash: string;
  readonly inputSnapshot: JsonValue | null;
  readonly outcome: string;
  readonly durationMs: number;
}

async function insertAuditRow(tx: Tx, row: AuditRowInput): Promise<void> {
  await tx.insert(auditLog).values({
    requestId: row.requestId,
    correlationId: row.correlationId,
    action: row.action,
    actorType: row.actorType,
    actorId: row.actorId,
    channel: row.channel,
    aiTraceId: row.aiTraceId ?? null,
    toolCallId: row.toolCallId ?? null,
    companyId: row.companyId,
    targetType: row.target.type,
    targetId: row.target.id,
    inputHash: row.inputHash,
    inputSnapshot: row.inputSnapshot,
    outcome: row.outcome,
    durationMs: row.durationMs,
  });
}

function hashInput(input: unknown): string {
  return canonicalJsonSha256(input as JsonSerializable);
}

function resolveFailureIdentity(
  principal: PrincipalInvocation,
  authorization: PreflightAuthorization | undefined,
): {
  actorType: "user" | "system";
  actorId: string;
  companyId: string | null;
} {
  if (authorization !== undefined) {
    return toAuditActor(authorization.actor, authorization.companyId);
  }
  switch (principal.mode) {
    case "system":
      return {
        actorType: "system",
        actorId: principal.serviceName,
        companyId:
          principal.scope.scope === "tenant" ? principal.scope.companyId : null,
      };
    case "staff":
    case "customer":
    case "consumer":
    case "account":
      if (principal.session !== null) {
        return {
          actorType: "user",
          actorId: principal.session.userId,
          companyId: null,
        };
      }
      return { actorType: "user", actorId: "unknown", companyId: null };
    case "public":
      return { actorType: "user", actorId: "unknown", companyId: null };
  }
}

function toAuditActor(
  actor: ActionActor,
  companyId: string | null,
): { actorType: "user" | "system"; actorId: string; companyId: string | null } {
  if (actor.type === "anonymous") {
    return { actorType: "user", actorId: "anonymous", companyId };
  }
  return { actorType: actor.type, actorId: actor.id, companyId };
}
