import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type AccountDb = Extract<ActionCtx, { principal: "account" }>["db"];
type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
export type WritableAccountDb = Extract<AccountDb, { insert: unknown }>;
export type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: AccountDb): WritableAccountDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("companies expected the writable transaction");
  }
  return db;
}

export function requireStaffWritable(db: StaffDb): WritableStaffDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("companies expected the writable transaction");
  }
  return db;
}
