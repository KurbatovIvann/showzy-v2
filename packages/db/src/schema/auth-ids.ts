/**
 * Hand-written companion to the generated `auth.ts` (db.md §4: that file is
 * regenerated only via `pnpm --filter @showzy/api auth:generate`, hand edits
 * forbidden — so this helper lives beside it instead of inside it).
 *
 * better-auth generates `text` primary keys. Module schema files declare
 * foreign keys to users through this helper so the user-ID column type is
 * written exactly once (companies-foundation §2) and a future upstream ID
 * type change surfaces here as one compile error instead of many drifted
 * columns.
 */
import { text } from "drizzle-orm/pg-core";

import { user } from "./auth.js";

/** The better-auth user primary-key value type. */
export type UserId = (typeof user.$inferSelect)["id"];

/**
 * Column builder for FKs to better-auth users, e.g.
 * `userIdColumn("user_id").notNull().references(() => user.id, { onDelete: "restrict" })`.
 * FK `ON DELETE` behavior stays a per-table decision (db.md §3), so callers
 * attach `.references()` themselves.
 */
export function userIdColumn(name: string) {
  return text(name);
}
