import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { companyLegalInfo } from "@showzy/db/schema/companies";
import type { z } from "zod";

import type {
  updateLegalInputSchema,
  updateLegalOutputSchema,
} from "../actions/update-legal.contract.js";
import {
  legalReturning,
  loadCompanyView,
  storedLegalFields,
} from "./company-view.js";
import { requireStaffWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type UpdateInput = z.output<typeof updateLegalInputSchema>;
type CompanyView = z.output<typeof updateLegalOutputSchema>;

export async function updateStaffLegal(env: {
  readonly ctx: StaffCtx;
  readonly input: UpdateInput;
}): Promise<CompanyView> {
  const { ctx, input } = env;
  const db = requireStaffWritable(ctx.db);
  const fields = storedLegalFields(input);

  const upserted = (
    await db
      .insert(companyLegalInfo)
      .values({
        id: randomUUID(),
        companyId: ctx.companyId,
        ...fields,
      })
      .onConflictDoUpdate({
        target: companyLegalInfo.companyId,
        set: fields,
      })
      .returning(legalReturning)
  )[0];
  if (upserted === undefined) {
    throw new CoreInvariantError(
      "companies.updateLegal upsert returned no row",
    );
  }

  ctx.log.info(
    { company_id: ctx.companyId },
    "companies.updateLegal upserted legal info",
  );
  return loadCompanyView(db, ctx.companyId);
}
