import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { companyCustomerInvites } from "@showzy/db/schema/invites";
import { and, eq } from "drizzle-orm";

import type { InviteView } from "../actions/invite-view.contract.js";
import { inviteRowColumns, toInviteView } from "./invite-view.js";
import type { WritableStaffDb } from "./writable.js";

export async function revokeStaffInvite(env: {
  readonly db: WritableStaffDb;
  readonly companyId: string;
  readonly inviteId: string;
}): Promise<{ readonly view: InviteView; readonly changed: boolean }> {
  const rows = await env.db
    .select(inviteRowColumns)
    .from(companyCustomerInvites)
    .where(
      and(
        eq(companyCustomerInvites.companyId, env.companyId),
        eq(companyCustomerInvites.id, env.inviteId),
      ),
    )
    .limit(1)
    .for("update");
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  if (row.status === "revoked") {
    return { view: toInviteView(row), changed: false };
  }

  const updated = (
    await env.db
      .update(companyCustomerInvites)
      .set({ status: "revoked" })
      .where(
        and(
          eq(companyCustomerInvites.companyId, env.companyId),
          eq(companyCustomerInvites.id, env.inviteId),
        ),
      )
      .returning(inviteRowColumns)
  )[0];
  if (updated === undefined) {
    throw new CoreInvariantError("invites.revoke update returned no row");
  }

  return { view: toInviteView(updated), changed: true };
}
