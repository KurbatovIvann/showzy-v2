/**
 * In-memory capability-token map for kit share-principal fixtures
 * (fnd-T11B). There is no foundation share-token table — resolvers in
 * later modules hash against their own rows. The kit only needs a stable
 * token A / token B / expired / revoked set so `shareIsolationSuite` can
 * prove the inherited cases.
 */
import { createHash } from "node:crypto";

import { NotFoundError } from "../errors/index.js";
import type { ResolvedTarget, TargetResolutionEnv } from "../runtime/types.js";
import { kitIdentities } from "./identities.js";

export const kitShareTokens = {
  a: "kit-share-token-a",
  b: "kit-share-token-b",
  expired: "kit-share-token-expired",
  revoked: "kit-share-token-revoked",
} as const;

export const kitShareDocuments = {
  a: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    companyId: kitIdentities.companies.a,
  },
  b: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    companyId: kitIdentities.companies.b,
  },
} as const;

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type KitShareStatus = "active" | "expired" | "revoked";

export interface KitShareResource {
  readonly documentId: string;
  readonly companyId: string;
  readonly status: KitShareStatus;
}

const records: Readonly<Record<string, KitShareResource>> = {
  [hashShareToken(kitShareTokens.a)]: {
    documentId: kitShareDocuments.a.id,
    companyId: kitShareDocuments.a.companyId,
    status: "active",
  },
  [hashShareToken(kitShareTokens.b)]: {
    documentId: kitShareDocuments.b.id,
    companyId: kitShareDocuments.b.companyId,
    status: "active",
  },
  [hashShareToken(kitShareTokens.expired)]: {
    documentId: kitShareDocuments.a.id,
    companyId: kitShareDocuments.a.companyId,
    status: "expired",
  },
  [hashShareToken(kitShareTokens.revoked)]: {
    documentId: kitShareDocuments.a.id,
    companyId: kitShareDocuments.a.companyId,
    status: "revoked",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readShareInput(input: unknown): {
  readonly token: string;
  readonly documentId: string;
} {
  if (!isRecord(input)) {
    throw new NotFoundError();
  }
  const token = input["token"];
  const documentId = input["documentId"];
  if (typeof token !== "string" || typeof documentId !== "string") {
    throw new NotFoundError();
  }
  return { token, documentId };
}

/**
 * Correct share resolver: missing, expired, revoked, or mismatched tokens
 * are `NotFoundError`. Returns the stored hash, never the raw secret.
 */
export function resolveKitShareTarget(
  input: unknown,
  env: TargetResolutionEnv,
): Promise<ResolvedTarget<KitShareResource>> {
  if (env.principal.mode !== "share") {
    throw new NotFoundError();
  }
  const { token, documentId } = readShareInput(input);
  const tokenHash = hashShareToken(token);
  const record = records[tokenHash];
  if (record === undefined || record.status !== "active") {
    throw new NotFoundError();
  }
  if (record.documentId !== documentId) {
    throw new NotFoundError();
  }
  return Promise.resolve({
    companyId: record.companyId,
    resource: record,
    tokenHash,
  });
}

/**
 * Seeded violation: looks up by document id and ignores the token, so
 * token A can reach token B's resource.
 */
export function resolveLeakyKitShareTarget(
  input: unknown,
  env: TargetResolutionEnv,
): Promise<ResolvedTarget<KitShareResource>> {
  if (env.principal.mode !== "share") {
    throw new NotFoundError();
  }
  const { documentId } = readShareInput(input);
  const record = Object.values(records).find(
    (entry) => entry.documentId === documentId && entry.status === "active",
  );
  if (record === undefined) {
    throw new NotFoundError();
  }
  return Promise.resolve({
    companyId: record.companyId,
    resource: record,
    tokenHash: hashShareToken(kitShareTokens.a),
  });
}
