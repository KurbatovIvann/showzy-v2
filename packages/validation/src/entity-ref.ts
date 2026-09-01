/**
 * Channel-neutral EntityRef (SHO-352 / ADR-0033): `{ by: "id" } | { by:
 * "query" }`. Query unique-match normalize is Unicode NFC, trim, collapse
 * internal whitespace, then case-fold. Max query length stays 100.
 */
import { z } from "zod";

export const ENTITY_REF_QUERY_MAX = 100;

export const REFERENCE_CONFLICT_LABELS_MAX = 5;

export const entityRefSchema = z.discriminatedUnion("by", [
  z.strictObject({
    by: z.literal("id"),
    id: z.uuid(),
  }),
  z.strictObject({
    by: z.literal("query"),
    value: z.string().trim().min(1).max(ENTITY_REF_QUERY_MAX),
  }),
]);

export type EntityRef = z.output<typeof entityRefSchema>;

/** NFC, trim, collapse internal whitespace. SQL ILIKE uses this (case via ILIKE). */
export function normalizeReferenceQuery(query: string): string {
  return query.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function normalizeUniqueMatchQuery(query: string): string {
  return normalizeReferenceQuery(query).toLowerCase();
}

export type UniqueMatchResult<T> =
  | { readonly kind: "unique"; readonly row: T }
  | { readonly kind: "none" }
  | { readonly kind: "ambiguous"; readonly rows: readonly T[] };

/**
 * Exact unique match may write. Contains-only hits (candidates that are
 * not an exact normalized field match) become CONFLICT and never
 * auto-choose — even when there is only one contains hit.
 */
export function fieldContainsQuery(
  field: string | null | undefined,
  query: string,
): boolean {
  if (field === null || field === undefined) {
    return false;
  }
  const needle = normalizeUniqueMatchQuery(query);
  if (needle.length === 0) {
    return false;
  }
  return normalizeUniqueMatchQuery(field).includes(needle);
}

export function candidatesContainingQuery<T>(
  query: string,
  rows: readonly T[],
  fieldsOf: (row: T) => readonly (string | null | undefined)[],
): T[] {
  return rows.filter((row) =>
    fieldsOf(row).some((field) => fieldContainsQuery(field, query)),
  );
}

export function pickUniqueNormalizedMatch<T>(
  query: string,
  candidates: readonly T[],
  fieldsOf: (row: T) => readonly (string | null | undefined)[],
): UniqueMatchResult<T> {
  const needle = normalizeUniqueMatchQuery(query);
  if (needle.length === 0) {
    return { kind: "none" };
  }
  const exact: T[] = [];
  for (const row of candidates) {
    const matches = fieldsOf(row).some(
      (field) =>
        field !== null &&
        field !== undefined &&
        normalizeUniqueMatchQuery(field) === needle,
    );
    if (matches) {
      exact.push(row);
    }
  }
  if (exact.length === 1) {
    const row = exact[0];
    if (row === undefined) {
      return { kind: "none" };
    }
    return { kind: "unique", row };
  }
  if (exact.length > 1) {
    return { kind: "ambiguous", rows: exact };
  }
  if (candidates.length > 0) {
    return { kind: "ambiguous", rows: candidates };
  }
  return { kind: "none" };
}

export function formatReferenceConflictMessage(
  query: string,
  labels: readonly string[],
): string {
  const shown = labels.slice(0, REFERENCE_CONFLICT_LABELS_MAX);
  return `Multiple matches for "${query}": ${shown.join("; ")}.`;
}
