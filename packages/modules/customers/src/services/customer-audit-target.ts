import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const customerIdHolder = z.object({ id: z.string() });

export function customerAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = customerIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "customer", id: fromOutput.data.id };
  }
  const fromInput = customerIdHolder.safeParse(env.input);
  return {
    type: "customer",
    id: fromInput.success ? fromInput.data.id : "uncreated",
  };
}
