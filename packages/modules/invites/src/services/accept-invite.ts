import { applyInviteCrm } from "@showzy/customers";
import type { ActionCtx, TargetResolutionEnv } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import {
  companyCustomerInviteRedemptions,
  companyCustomerInvites,
} from "@showzy/db/schema/invites";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";

import type { acceptInviteOutputSchema } from "../actions/accept.contract.js";
import { derivedInviteStatus } from "./invite-view.js";
import { mapInviteWriteError } from "./postgres-error.js";
import { hashInviteToken } from "./token-hash.js";
import { requireCustomerWritable } from "./writable.js";

type CustomerCtx = Extract<ActionCtx, { principal: "customer" }>;
type AcceptOutput = z.output<typeof acceptInviteOutputSchema>;

export type AcceptInviteTarget = {
  readonly id: string;
  readonly companyId: string;
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
};

export const acceptInviteColumns = {
  id: companyCustomerInvites.id,
  companyId: companyCustomerInvites.companyId,
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
};

export async function resolveAcceptInviteTarget(
  input: { readonly token: string },
  env: TargetResolutionEnv,
): Promise<{ companyId: string; resource: AcceptInviteTarget }> {
  if (env.principal.mode !== "customer") {
    throw new NotFoundError();
  }

  const tokenHash = hashInviteToken(input.token);
  const row = (
    await env.tx
      .select(acceptInviteColumns)
      .from(companyCustomerInvites)
      .where(eq(companyCustomerInvites.tokenHash, tokenHash))
      .limit(1)
  )[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const derived = derivedInviteStatus(row);
  if (derived === "pending") {
    return { companyId: row.companyId, resource: row };
  }
  if (derived === "exhausted") {
    const redemption = (
      await env.tx
        .select({ id: companyCustomerInviteRedemptions.id })
        .from(companyCustomerInviteRedemptions)
        .where(
          and(
            eq(companyCustomerInviteRedemptions.inviteId, row.id),
            eq(companyCustomerInviteRedemptions.userId, env.principal.userId),
          ),
        )
        .limit(1)
    )[0];
    if (redemption !== undefined) {
      return { companyId: row.companyId, resource: row };
    }
  }
  throw new NotFoundError();
}

export async function acceptCustomerInvite(env: {
  readonly ctx: CustomerCtx & { target: { resource: AcceptInviteTarget } };
}): Promise<AcceptOutput & { replayed: boolean }> {
  const { ctx } = env;
  const db = requireCustomerWritable(ctx.db);
  const userId = ctx.userId;
  const inviteId = ctx.target.resource.id;
  const companyId = ctx.target.companyId;

  const locked = (
    await db
      .select(acceptInviteColumns)
      .from(companyCustomerInvites)
      .where(
        and(
          eq(companyCustomerInvites.companyId, companyId),
          eq(companyCustomerInvites.id, inviteId),
        ),
      )
      .limit(1)
      .for("update")
  )[0];
  if (locked === undefined) {
    throw new NotFoundError();
  }

  const existingRedemption = (
    await db
      .select({
        id: companyCustomerInviteRedemptions.id,
        companyCustomerId: companyCustomerInviteRedemptions.companyCustomerId,
      })
      .from(companyCustomerInviteRedemptions)
      .where(
        and(
          eq(companyCustomerInviteRedemptions.inviteId, inviteId),
          eq(companyCustomerInviteRedemptions.userId, userId),
        ),
      )
      .limit(1)
  )[0];

  if (existingRedemption !== undefined) {
    return {
      inviteId,
      customerId: existingRedemption.companyCustomerId,
      created: false,
      replayed: true,
    };
  }

  if (derivedInviteStatus(locked) !== "pending") {
    throw new NotFoundError();
  }

  const crm = await ctx.callAtomic(applyInviteCrm, {
    groupId: locked.groupId,
    priceListId: locked.priceListId,
    name: locked.name,
    phone: locked.phone,
    email: locked.email,
    matchUnlinkedContact: !locked.isReusable,
  });

  const incremented = (
    await db
      .update(companyCustomerInvites)
      .set({
        usesCount: sql`${companyCustomerInvites.usesCount} + 1`,
      })
      .where(
        and(
          eq(companyCustomerInvites.companyId, companyId),
          eq(companyCustomerInvites.id, inviteId),
          eq(companyCustomerInvites.status, "pending"),
          or(
            isNull(companyCustomerInvites.maxUses),
            lt(
              companyCustomerInvites.usesCount,
              companyCustomerInvites.maxUses,
            ),
          ),
        ),
      )
      .returning({ id: companyCustomerInvites.id })
  )[0];
  if (incremented === undefined) {
    throw new NotFoundError();
  }

  try {
    await db.insert(companyCustomerInviteRedemptions).values({
      inviteId,
      companyId,
      userId,
      companyCustomerId: crm.customerId,
      acceptedAt: new Date(),
    });
  } catch (error) {
    throw mapInviteWriteError(error);
  }

  ctx.log.info(
    { invite_id: inviteId, customer_id: crm.customerId },
    "invites.accept accepted invite",
  );

  return {
    inviteId,
    customerId: crm.customerId,
    created: crm.created,
    replayed: false,
  };
}

export function assertCustomerAcceptCtx(
  ctx: ActionCtx,
): asserts ctx is CustomerCtx & {
  target: { resource: AcceptInviteTarget };
} {
  if (ctx.principal !== "customer") {
    throw new CoreInvariantError("invites.accept expects customer");
  }
}
