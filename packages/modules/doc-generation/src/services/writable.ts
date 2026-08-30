import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type SystemDb = Extract<ActionCtx, { principal: "system" }>["db"];
type WritableSystemDb = Extract<SystemDb, { insert: unknown }>;

export function requireWritable(db: SystemDb): WritableSystemDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError(
      "doc-generation expected the writable transaction",
    );
  }
  return db;
}
