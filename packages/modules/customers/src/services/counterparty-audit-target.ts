import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const counterpartyIdHolder = z.object({ id: z.string() });

export function counterpartyAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = counterpartyIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "counterparty", id: fromOutput.data.id };
  }
  const fromInput = counterpartyIdHolder.safeParse(env.input);
  return {
    type: "counterparty",
    id: fromInput.success ? fromInput.data.id : "uncreated",
  };
}
