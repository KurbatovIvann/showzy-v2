import { ValidationError } from "@showzy/core/errors";
import {
  DECIMAL_QUANTITY_MESSAGE,
  decimalQuantityToMilli,
} from "@showzy/validation/money";
import type { z } from "zod";

export { DECIMAL_QUANTITY_MESSAGE, decimalQuantityToMilli };

export function quantityInputToMilli(
  quantity: { readonly milli: string } | { readonly decimal: string },
): string {
  if ("milli" in quantity) {
    return quantity.milli;
  }
  const milli = decimalQuantityToMilli(quantity.decimal);
  if (milli === undefined) {
    const issue: z.core.$ZodIssue = {
      code: "custom",
      path: ["quantity"],
      message: DECIMAL_QUANTITY_MESSAGE,
      input: quantity.decimal,
    };
    throw new ValidationError([issue], DECIMAL_QUANTITY_MESSAGE);
  }
  return milli.toString(10);
}
