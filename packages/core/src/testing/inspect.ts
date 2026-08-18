/**
 * Output inspectors for the isolation suites (core.md §12). They walk a
 * JSON value and name the exact parity-fixture ids or internal fields a
 * leaky action returned, so a failure is attributable to a seeded row
 * rather than a generic "not isolated" assertion.
 */
import { parityIds } from "@showzy/db/testing/fixtures";

import { kitIdentities } from "./identities.js";

/** Resources that must never appear in public/consumer/public-global output. */
export const unpublishedResourceIds: readonly string[] = [
  kitIdentities.companies.b,
  kitIdentities.products.unpublished,
  kitIdentities.products.ofUnpublishedCompany,
];

const INTERNAL_NOTE_PREFIX = "internal:";

export function collectJsonStrings(value: unknown): string[] {
  const strings: string[] = [];
  walk(value, {
    onString(text) {
      strings.push(text);
    },
  });
  return strings;
}

export function collectJsonKeys(value: unknown): string[] {
  const keys: string[] = [];
  walk(value, {
    onKey(key) {
      keys.push(key);
    },
  });
  return keys;
}

export function findUnpublishedLeaks(output: unknown): string[] {
  const seen = new Set(collectJsonStrings(output));
  return unpublishedResourceIds.filter((id) => seen.has(id));
}

/**
 * Allowlist escape: an `internalNote` key, or any string that carries the
 * fixture tables' `internal:` prefix (db.md §8).
 */
export function findInternalFieldLeaks(output: unknown): string[] {
  const leaks: string[] = [];
  for (const key of collectJsonKeys(output)) {
    if (key === "internalNote") {
      leaks.push(key);
    }
  }
  for (const text of collectJsonStrings(output)) {
    if (text.startsWith(INTERNAL_NOTE_PREFIX)) {
      leaks.push(text);
    }
  }
  return leaks;
}

/** Private-collection user ids that discovery reads must not echo. */
export function findPrivateUserLeaks(output: unknown): string[] {
  const seen = new Set(collectJsonStrings(output));
  return [parityIds.users.anna, parityIds.users.boris].filter((id) =>
    seen.has(id),
  );
}

function walk(
  value: unknown,
  visitors: {
    readonly onString?: (text: string) => void;
    readonly onKey?: (key: string) => void;
  },
): void {
  if (typeof value === "string") {
    visitors.onString?.(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      walk(entry, visitors);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      visitors.onKey?.(key);
      walk(entry, visitors);
    }
  }
}
