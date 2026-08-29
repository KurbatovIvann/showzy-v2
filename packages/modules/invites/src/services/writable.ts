import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
export type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: StaffDb): WritableStaffDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("invites expected the writable transaction");
  }
  return db;
}
