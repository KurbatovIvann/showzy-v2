import { CoreInvariantError } from "@showzy/core/errors";

export type WritableOf<Db> = Extract<Db, { insert: unknown }>;

function hasInsert<Db extends object>(
  db: Db,
): db is Extract<Db, { insert: unknown }> {
  return "insert" in db;
}

export function requireWritable<Db extends object>(
  db: Db,
  label: string,
): Extract<Db, { insert: unknown }> {
  if (!hasInsert(db)) {
    throw new CoreInvariantError(`${label} expected the writable transaction`);
  }
  return db;
}
