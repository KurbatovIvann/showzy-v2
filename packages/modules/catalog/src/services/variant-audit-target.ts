import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const variantIdHolder = z.object({ variantId: z.string() });

export function variantAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = variantIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "variant", id: fromOutput.data.variantId };
  }
  const fromInput = variantIdHolder.safeParse(env.input);
  return {
    type: "variant",
    id: fromInput.success ? fromInput.data.variantId : "uncreated",
  };
}
