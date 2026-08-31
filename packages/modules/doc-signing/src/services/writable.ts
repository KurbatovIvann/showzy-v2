import type { ActionCtx } from "@showzy/core";
import { requireWritable as requireWritableTx } from "@showzy/module-kit/writable";

type SystemDb = Extract<ActionCtx, { principal: "system" }>["db"];
type WritableSystemDb = Extract<SystemDb, { insert: unknown }>;
type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: SystemDb): WritableSystemDb {
  return requireWritableTx(db, "doc-signing");
}

export function requireStaffWritable(db: StaffDb): WritableStaffDb {
  return requireWritableTx(db, "doc-signing");
}
