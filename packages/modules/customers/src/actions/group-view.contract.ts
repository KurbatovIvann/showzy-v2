import { z } from "zod";

/** Same cap as catalog / companies names (SHO-169 mechanical). */
export const GROUP_NAME_MAX = 120;
export const GROUP_DESCRIPTION_MAX = 2000;

/**
 * Server-generated slug ceiling. Transliteration is sliced to this; the
 * collision/empty fallback `group-{8 hex}` is well under it.
 */
export const GROUP_SLUG_MAX = 80;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name must not be blank." })
  .max(GROUP_NAME_MAX);

export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(GROUP_DESCRIPTION_MAX)
  .optional();

/**
 * Created/updated group. `slug` is a server field (not accepted on input;
 * the UI may ignore it). `memberCount` is the number of *active*
 * `company_customers` rows with this `group_id` — archived members are
 * excluded (SHO-172).
 */
export const groupViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string().min(1).max(GROUP_SLUG_MAX),
  description: z.string().nullable(),
  priceListId: z.uuid().nullable(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
