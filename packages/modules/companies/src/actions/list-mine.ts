import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { companies, companyMembers } from "@showzy/db/schema/companies";
import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import { asc, eq } from "drizzle-orm";
import type { z } from "zod";

import {
  companyMemberRoleSchema,
  listMineContract,
} from "./list-mine.contract.js";

function parseRole(value: string): z.output<typeof companyMemberRoleSchema> {
  return parseDbEnum(
    companyMemberRoleSchema,
    value,
    `company_members row has illegal role "${value}"`,
  );
}

export const listMine = implementAction(listMineContract, {
  handler: async (_input, ctx) => {
    if (ctx.principal !== "account") {
      throw new CoreInvariantError("companies.listMine expects account");
    }

    const rows = await ctx.db
      .select({
        membershipId: companyMembers.id,
        role: companyMembers.role,
        companyId: companies.id,
        companyName: companies.name,
        companySlug: companies.slug,
        companyPrefix: companies.prefix,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companyMembers.companyId, companies.id))
      .where(eq(companyMembers.userId, ctx.userId))
      .orderBy(asc(companyMembers.createdAt), asc(companyMembers.id));

    return {
      memberships: rows.map((row) => ({
        membershipId: row.membershipId,
        role: parseRole(row.role),
        company: {
          id: row.companyId,
          name: row.companyName,
          slug: row.companySlug,
          prefix: row.companyPrefix,
        },
      })),
    };
  },
});
