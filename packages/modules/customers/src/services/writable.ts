import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type CustomerDb = Extract<ActionCtx, { principal: "customer" }>["db"];
export type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;
export type WritableCustomerDb = Extract<CustomerDb, { insert: unknown }>;

export function requireWritable(db: StaffDb): WritableStaffDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError("customers expected the writable transaction");
  }
  return db;
}

export function requireCustomerWritable(db: CustomerDb): WritableCustomerDb {
  if (!("insert" in db)) {
    throw new CoreInvariantError(
      "customers.applyInviteCrm expected the writable transaction",
    );
  }
  return db;
}
