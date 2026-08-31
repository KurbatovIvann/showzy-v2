import type { ActionCtx } from "@showzy/core";
import { requireWritable as requireWritableTx } from "@showzy/module-kit/writable";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type CustomerDb = Extract<ActionCtx, { principal: "customer" }>["db"];
export type WritableStaffDb = Extract<StaffDb, { insert: unknown }>;
export type WritableCustomerDb = Extract<CustomerDb, { insert: unknown }>;

export function requireWritable(db: StaffDb): WritableStaffDb {
  return requireWritableTx(db, "customers");
}

export function requireCustomerWritable(db: CustomerDb): WritableCustomerDb {
  return requireWritableTx(db, "customers.applyInviteCrm");
}
