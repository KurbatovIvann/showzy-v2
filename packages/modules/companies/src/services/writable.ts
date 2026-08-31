import type { ActionCtx } from "@showzy/core";
import { requireWritable as requireWritableTx } from "@showzy/module-kit/writable";

type AccountDb = Extract<ActionCtx, { principal: "account" }>["db"];
type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
export type WritableAccountDb = Extract<AccountDb, { insert: unknown }>;
export type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: AccountDb): WritableAccountDb {
  return requireWritableTx(db, "companies");
}

export function requireStaffWritable(db: StaffDb): WritableStaffDb {
  return requireWritableTx(db, "companies");
}
