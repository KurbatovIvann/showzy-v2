import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: StaffDb): WritableStaffDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("orders expected the writable transaction");
  }
  return db;
}
