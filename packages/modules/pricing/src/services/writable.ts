import type { ActionCtx } from "@showzy/core";
import { requireWritable as requireWritableTx } from "@showzy/module-kit/writable";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
export type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: StaffDb): WritableStaffDb {
  return requireWritableTx(db, "pricing");
}
