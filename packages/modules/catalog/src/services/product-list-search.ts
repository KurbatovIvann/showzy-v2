/**
 * Staff catalog list matcher (SHO-396 / SHO-400). Name is token-AND of
 * `nameSearchStems` as word-prefix ILIKE (stem at start of the name or
 * after a space). Catalog list search is name-only. Undefined means
 * "match nothing" (LIKE sanitize emptied the query).
 *
 * Stems are suffix-stripped prefixes of query tokens, so they match at
 * name-token starts. Mid-word `%stem%` would let a 1-character token
 * (`A` in "Product A") match any name that contains that letter
 * ("Product Extra"). Copied from the T2 customers matcher; do not import
 * customers services.
 */
import { products } from "@showzy/db/schema/catalog";
import {
  likeContainsPattern,
  nameSearchStems,
} from "@showzy/validation/pagination";
import { and, ilike, or, type SQL } from "drizzle-orm";

function nameContainsStem(stem: string): SQL | undefined {
  return or(
    ilike(products.name, `${stem}%`),
    ilike(products.name, `% ${stem}%`),
  );
}

export function productListSearchPredicate(query: string): SQL | undefined {
  const normalized = query.normalize("NFC").trim().replaceAll(/\s+/g, " ");
  const stems = nameSearchStems(normalized);
  if (stems.length === 0) {
    return undefined;
  }

  let nameMatch: SQL | undefined;
  for (const stem of stems) {
    if (likeContainsPattern(stem) === undefined) {
      continue;
    }
    const clause = nameContainsStem(stem);
    if (clause === undefined) {
      continue;
    }
    nameMatch = nameMatch === undefined ? clause : and(nameMatch, clause);
  }
  return nameMatch;
}
