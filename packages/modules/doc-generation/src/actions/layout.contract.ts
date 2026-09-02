/**
 * Shared layout catalog shapes for `docGeneration.listLayouts` and
 * `docGeneration.resolveLayout` (SHO-363 / feature SHO-362). Keys are
 * code, not a table. Company id is never input.
 */
import { z } from "zod";

export const documentLayoutTypeSchema = z.enum([
  "payment_invoice",
  "delivery_note",
]);

export const documentLayoutKeySchema = z.enum([
  "payment_invoice.plain",
  "payment_invoice.branded",
  "delivery_note.plain",
  "delivery_note.parties",
]);

export const documentLayoutRowSchema = z.strictObject({
  key: documentLayoutKeySchema,
  type: documentLayoutTypeSchema,
  labelUk: z.string().min(1),
  labelEn: z.string().min(1),
  isDefault: z.boolean(),
});

export type DocumentLayoutType = z.infer<typeof documentLayoutTypeSchema>;
export type DocumentLayoutKey = z.infer<typeof documentLayoutKeySchema>;
