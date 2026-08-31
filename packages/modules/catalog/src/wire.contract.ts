import { z } from "zod";

export {
  DEFAULT_PRODUCT_CURRENCY,
  PRODUCT_NAME_MAX,
  catalogNameSchema,
  currencyCodeSchema,
} from "@showzy/validation/catalog";
export {
  INT64_MAX,
  INT64_MIN,
  moneyWireSchema,
  nonNegativeMoneyWireSchema,
} from "@showzy/validation/money";

export const productStatusSchema = z.enum(["active", "archived"]);
