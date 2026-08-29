import { CoreInvariantError } from "@showzy/core/errors";
import { companyCustomerInvites } from "@showzy/db/schema/invites";

import {
  inviteStoredStatusSchema,
  type InviteDerivedStatus,
  type InviteView,
} from "../actions/invite-view.contract.js";

export const inviteRowColumns = {
  id: companyCustomerInvites.id,
  isReusable: companyCustomerInvites.isReusable,
  maxUses: companyCustomerInvites.maxUses,
  usesCount: companyCustomerInvites.usesCount,
  expiresAt: companyCustomerInvites.expiresAt,
  status: companyCustomerInvites.status,
  groupId: companyCustomerInvites.groupId,
  priceListId: companyCustomerInvites.priceListId,
  name: companyCustomerInvites.name,
  phone: companyCustomerInvites.phone,
  email: companyCustomerInvites.email,
  invitedBy: companyCustomerInvites.invitedBy,
  createdAt: companyCustomerInvites.createdAt,
  updatedAt: companyCustomerInvites.updatedAt,
};

export type InviteRow = {
  readonly id: string;
  readonly isReusable: boolean;
  readonly maxUses: number | null;
  readonly usesCount: number;
  readonly expiresAt: Date;
  readonly status: string;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly invitedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function nullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value;
}

export function nullableUuid(value: string | null | undefined): string | null {
  return value ?? null;
}

function parseStoredStatus(value: string): "pending" | "revoked" {
  const parsed = inviteStoredStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `company_customer_invites row has illegal status "${value}"`,
    );
  }
  return parsed.data;
}

export function derivedInviteStatus(
  row: {
    readonly status: string;
    readonly expiresAt: Date;
    readonly maxUses: number | null;
    readonly usesCount: number;
  },
  now: Date = new Date(),
): InviteDerivedStatus {
  if (parseStoredStatus(row.status) === "revoked") {
    return "revoked";
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  if (row.maxUses !== null && row.usesCount >= row.maxUses) {
    return "exhausted";
  }
  return "pending";
}

export function toInviteView(row: InviteRow, now?: Date): InviteView {
  return {
    id: row.id,
    isReusable: row.isReusable,
    maxUses: row.maxUses,
    usesCount: row.usesCount,
    expiresAt: row.expiresAt.toISOString(),
    status: derivedInviteStatus(row, now),
    groupId: row.groupId,
    priceListId: row.priceListId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
