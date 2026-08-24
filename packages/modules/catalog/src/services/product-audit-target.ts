import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const productIdHolder = z.object({ productId: z.string() });

export function productAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = productIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "product", id: fromOutput.data.productId };
  }
  const fromInput = productIdHolder.safeParse(env.input);
  return {
    type: "product",
    id: fromInput.success ? fromInput.data.productId : "uncreated",
  };
}
