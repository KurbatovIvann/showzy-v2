/**
 * Server-side numbering-prefix generation (SHO-127, mechanical contract
 * detail). Deterministic where possible: the base is derived from the
 * company name alone; only the collision suffix depends on which prefixes
 * already exist.
 *
 * Base derivation folds the name to ASCII-adjacent uppercase (NFKD +
 * combining-mark strip), then takes the initials of up to the first three
 * Latin/digit words, or the first two characters of a single word. Names
 * with no usable characters after folding (punctuation-only or non-Latin
 * scripts such as Cyrillic) fall back to `"CO"` — the collision suffix
 * keeps those unique.
 */
import { CoreInvariantError } from "@showzy/core/errors";

export const PREFIX_FALLBACK_BASE = "CO";

const PREFIX_WORD_INITIALS_MAX = 3;
const PREFIX_SINGLE_WORD_CHARS = 2;

export function derivePrefixBase(name: string): string {
  const folded = name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase();
  const words = folded.match(/[A-Z0-9]+/gu) ?? [];
  const first = words[0];
  if (first === undefined) {
    return PREFIX_FALLBACK_BASE;
  }
  if (words.length === 1) {
    return first.slice(0, PREFIX_SINGLE_WORD_CHARS);
  }
  return words
    .slice(0, PREFIX_WORD_INITIALS_MAX)
    .map((word) => word.charAt(0))
    .join("");
}

/**
 * First free candidate in the deterministic sequence `base`, `base2`,
 * `base3`, … By pigeonhole a free candidate exists within `taken.size + 2`
 * attempts; running past that bound means the taken set and the loop
 * disagree, which is a server bug.
 */
export function pickAvailablePrefix(
  base: string,
  taken: ReadonlySet<string>,
): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix <= taken.size + 2; suffix += 1) {
    const candidate = `${base}${String(suffix)}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new CoreInvariantError(
    `prefix candidate scan for base "${base}" exhausted ${String(taken.size + 2)} attempts`,
  );
}
