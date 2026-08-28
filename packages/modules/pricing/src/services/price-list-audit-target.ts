import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const priceListIdHolder = z.object({ id: z.string() });

export function priceListAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = priceListIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "price_list", id: fromOutput.data.id };
  }
  const fromInput = priceListIdHolder.safeParse(env.input);
  return {
    type: "price_list",
    id: fromInput.success ? fromInput.data.id : "uncreated",
  };
}
