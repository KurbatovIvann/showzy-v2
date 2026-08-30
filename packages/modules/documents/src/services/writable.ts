import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;
type SystemDb = Extract<ActionCtx, { principal: "system" }>["db"];
type WritableSystemDb = Extract<SystemDb, { insert: unknown }>;

export function requireWritable(db: StaffDb): WritableStaffDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("documents expected the writable transaction");
  }
  return db;
}

export function requireSystemWritable(db: SystemDb): WritableSystemDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("documents expected the writable transaction");
  }
  return db;
}
