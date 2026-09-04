/**
 * Staff CRM list matcher (SHO-396 / SHO-398). Name is token-AND of
 * `nameSearchStems` ILIKE contains; phone and email stay full-string
 * contains. The row matches name-AND OR phone OR email. Undefined means
 * "match nothing" (LIKE sanitize emptied the query).
 */
import { companyCustomers } from "@showzy/db/schema/customers";
import {
  likeContainsPattern,
  nameSearchStems,
} from "@showzy/validation/pagination";
import { and, ilike, or, type SQL } from "drizzle-orm";

export function customerListSearchPredicate(query: string): SQL | undefined {
  const normalized = query.normalize("NFC").trim().replaceAll(/\s+/g, " ");
  const stems = nameSearchStems(normalized);
  if (stems.length === 0) {
    return undefined;
  }

  let nameMatch: SQL | undefined;
  for (const stem of stems) {
    const pattern = likeContainsPattern(stem);
    if (pattern === undefined) {
      continue;
    }
    const clause = ilike(companyCustomers.name, pattern);
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
