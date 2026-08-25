import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const productIdHolder = z.object({ productId: z.string() });
const variantIdHolder = z.object({ variantId: z.string() });

export function productAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const parsed = productIdHolder.safeParse(env.input);
  return {
    type: "product",
    id: parsed.success ? parsed.data.productId : "unknown",
  };
}

export function variantAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const parsed = variantIdHolder.safeParse(env.input);
  return {
    type: "product_variant",
    id: parsed.success ? parsed.data.variantId : "unknown",
  };
}
