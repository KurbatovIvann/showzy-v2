/**
 * UI draft Zod for the group form (SHO-181). Caps from
 * `@showzy/validation/customers`. This is not the customers action wire
 * schema.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
} from "@showzy/validation/customers";
import { z } from "zod";

export { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX };

export type NameErrorKey = "required" | "too_long";
export type LengthErrorKey = "too_long";

export type GroupFormFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly description: LengthErrorKey | null;
};

export function emptyFieldErrors(): GroupFormFieldErrors {
  return {
    name: null,
    description: null,
  };
}

export function isNameErrorKey(value: string): value is NameErrorKey {
  return value === "required" || value === "too_long";
}

export function isLengthErrorKey(value: string): value is LengthErrorKey {
  return value === "too_long";
}

export const groupFormNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "required" })
  .refine((value) => value.trim().length <= GROUP_NAME_MAX, {
    message: "too_long",
  });

export const groupFormDraftSchema = z.object({
  name: groupFormNameSchema,
  description: z
    .string()
    .refine((value) => value.trim().length <= GROUP_DESCRIPTION_MAX, {
      message: "too_long",
    }),
  priceListId: z.uuid().nullable(),
});

export const groupFormResolver = zodResolver(groupFormDraftSchema);

/**
 * Map UI-schema issues onto field copy keys. The schema `message` values
 * are keys (`required` / `too_long`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): GroupFormFieldErrors {
  let name: NameErrorKey | null = null;
  let description: LengthErrorKey | null = null;
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isNameErrorKey(issue.message)) {
      name = issue.message;
      continue;
    }
    if (root === "description" && isLengthErrorKey(issue.message)) {
      description = issue.message;
    }
  }
  return { name, description };
}
