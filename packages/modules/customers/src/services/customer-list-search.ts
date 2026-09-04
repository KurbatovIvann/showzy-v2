/**
 * Staff CRM list matcher (SHO-396 / SHO-398). Name is token-AND of
 * `nameSearchStems` as word-prefix ILIKE (stem at start of the name or
 * after a space). Phone and email stay full-string contains. The row
 * matches name-AND OR phone OR email. Undefined means "match nothing"
 * (LIKE sanitize emptied the query).
 *
 * Stems are suffix-stripped prefixes of query tokens, so they match at
 * name-token starts. Mid-word `%stem%` would let a 1-character token
 * (`A` in "Customer A") match any name that contains that letter
 * ("Customer Extra") and break inherited `orders.list` query isolation.
 */
import { companyCustomers } from "@showzy/db/schema/customers";
import {
  likeContainsPattern,
  nameSearchStems,
} from "@showzy/validation/pagination";
import { and, ilike, or, type SQL } from "drizzle-orm";

function nameContainsStem(stem: string): SQL | undefined {
  return or(
    ilike(companyCustomers.name, `${stem}%`),
    ilike(companyCustomers.name, `% ${stem}%`),
  );
}

export function customerListSearchPredicate(query: string): SQL | undefined {
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
  if (nameMatch === undefined) {
    return undefined;
  }

  const contains = likeContainsPattern(normalized);
  if (contains === undefined) {
    return nameMatch;
  }
  return or(
    nameMatch,
    ilike(companyCustomers.phone, contains),
    ilike(companyCustomers.email, contains),
  );
}
