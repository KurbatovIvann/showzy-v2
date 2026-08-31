import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import type { z } from "zod";

import {
  documentStatusSchema,
  documentTypeSchema,
} from "../actions/document-view.contract.js";

export function parseType(value: string): z.output<typeof documentTypeSchema> {
  return parseDbEnum(
    documentTypeSchema,
    value,
    `documents row has illegal type "${value}"`,
  );
}

export function parseStatus(
  value: string,
): z.output<typeof documentStatusSchema> {
  return parseDbEnum(
    documentStatusSchema,
    value,
    `documents row has illegal status "${value}"`,
  );
}
