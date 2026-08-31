import { z } from "zod";

export {
  moneyWireSchema,
  quantityMilliWireSchema,
} from "@showzy/validation/money";

/** Calendar day `YYYY-MM-DD` (Kyiv `issued_on`, not an instant). */
export const calendarDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD calendar day");
