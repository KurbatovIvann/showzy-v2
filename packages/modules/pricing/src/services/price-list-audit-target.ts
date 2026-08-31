import {
  createAuditTarget,
  pickNullableStringOr,
  pickString,
} from "@showzy/module-kit/audit-target";
import { z } from "zod";

const priceListIdHolder = z.object({ id: z.string() });
const priceListIdAliasHolder = z.object({
  priceListId: z.string().nullable(),
});

export const priceListAuditTarget = createAuditTarget({
  type: "price_list",
  fallback: "uncreated",
  steps: [
    {
      source: "output",
      schema: priceListIdHolder,
      pick: (data) => pickString("id", data),
    },
    {
      source: "output",
      schema: priceListIdAliasHolder,
      pick: (data) => pickString("priceListId", data),
    },
    {
      source: "input",
      schema: priceListIdHolder,
      pick: (data) => pickString("id", data),
    },
    {
      source: "input",
      schema: priceListIdAliasHolder,
      pick: (data) => pickNullableStringOr("priceListId", "none", data),
    },
  ],
});
