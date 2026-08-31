import { z } from "zod";

export {
  INT64_MAX,
  INT64_MIN,
  moneyWireSchema,
  nonNegativeMoneyWireSchema,
} from "@showzy/validation/money";

/** MVP is UAH-only (db.md §11); the column is reserved for a later ADR. */
export const DEFAULT_PRICE_CURRENCY = "UAH";
export const currencyCodeSchema = z.literal("UAH");
