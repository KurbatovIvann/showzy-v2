import { implementAction, type AuditTargetEnv } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { z } from "zod";

import { createOwnedCompany } from "../services/create-company.js";
import { createCompanyContract } from "./create.contract.js";

const companyIdHolder = z.object({ company: z.object({ id: z.string() }) });

function createAuditTarget(env: AuditTargetEnv): { type: string; id: string } {
  const fromOutput = companyIdHolder.safeParse(env.output);
  return {
    type: "company",
    id: fromOutput.success ? fromOutput.data.company.id : "uncreated",
  };
}

export const createCompany = implementAction(createCompanyContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "account") {
      throw new CoreInvariantError("companies.create expects account");
    }
    return createOwnedCompany({ ctx, input });
  },
  auditTarget: createAuditTarget,
});
