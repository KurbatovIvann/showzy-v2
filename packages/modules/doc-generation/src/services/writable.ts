import type { ActionCtx } from "@showzy/core";
import { requireWritable as requireWritableTx } from "@showzy/module-kit/writable";

type SystemDb = Extract<ActionCtx, { principal: "system" }>["db"];
type WritableSystemDb = Extract<SystemDb, { insert: unknown }>;

export function requireWritable(db: SystemDb): WritableSystemDb {
  return requireWritableTx(db, "doc-generation");
}
