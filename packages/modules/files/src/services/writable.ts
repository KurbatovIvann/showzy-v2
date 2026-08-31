import type { ActionCtx } from "@showzy/core";
import { requireWritable as requireWritableTx } from "@showzy/module-kit/writable";

type MutationCtx = Extract<ActionCtx, { principal: "staff" | "system" }>;
type MutationDb = MutationCtx["db"];
type WritableDb = Extract<MutationDb, { insert: unknown }>;

export function requireWritable(db: MutationDb): WritableDb {
  return requireWritableTx(db, "files");
}
