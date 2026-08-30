import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type SystemDb = Extract<ActionCtx, { principal: "system" }>["db"];
type WritableSystemDb = Extract<SystemDb, { insert: unknown }>;
type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;

export function requireWritable(db: SystemDb): WritableSystemDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError(
      "doc-signing expected the writable transaction",
    );
  }
  return db;
}

export function requireStaffWritable(db: StaffDb): WritableStaffDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError(
      "doc-signing expected the writable transaction",
    );
  }
  return db;
}
