import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import type { z } from "zod";

import { orderStatusSchema } from "../actions/order-view.contract.js";

export function parseStatus(value: string): z.output<typeof orderStatusSchema> {
  return parseDbEnum(
    orderStatusSchema,
    value,
    `orders row has illegal status "${value}"`,
  );
}
