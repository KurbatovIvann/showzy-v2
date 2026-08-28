import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const priceListIdHolder = z.object({ id: z.string() });
const priceListIdAliasHolder = z.object({
  priceListId: z.string().nullable(),
});

export function priceListAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = priceListIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "price_list", id: fromOutput.data.id };
  }
  const fromOutputAlias = priceListIdAliasHolder.safeParse(env.output);
  if (fromOutputAlias.success && fromOutputAlias.data.priceListId !== null) {
    return { type: "price_list", id: fromOutputAlias.data.priceListId };
  }
  const fromInput = priceListIdHolder.safeParse(env.input);
  if (fromInput.success) {
    return { type: "price_list", id: fromInput.data.id };
  }
  const fromInputAlias = priceListIdAliasHolder.safeParse(env.input);
  if (!fromInputAlias.success) {
    return { type: "price_list", id: "uncreated" };
  }
  return {
    type: "price_list",
    id: fromInputAlias.data.priceListId ?? "none",
  };
}
