import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type MutationCtx = Extract<ActionCtx, { principal: "staff" | "system" }>;
type MutationDb = MutationCtx["db"];
type WritableDb = Extract<MutationDb, { insert: unknown }>;

export function requireWritable(db: MutationDb): WritableDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("files expected the writable transaction");
  }
  return db;
}
