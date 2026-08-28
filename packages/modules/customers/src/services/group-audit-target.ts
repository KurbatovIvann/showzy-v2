import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const groupIdHolder = z.object({ id: z.string() });

export function groupAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = groupIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "customer_group", id: fromOutput.data.id };
  }
  const fromInput = groupIdHolder.safeParse(env.input);
  return {
    type: "customer_group",
    id: fromInput.success ? fromInput.data.id : "uncreated",
  };
}
