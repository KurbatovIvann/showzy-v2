import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type AccountDb = Extract<ActionCtx, { principal: "account" }>["db"];
export type WritableAccountDb = Extract<AccountDb, { insert: unknown }>;

export function requireWritable(db: AccountDb): WritableAccountDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("companies expected the writable transaction");
  }
  return db;
}
