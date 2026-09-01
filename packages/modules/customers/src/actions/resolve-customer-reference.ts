import { implementAction } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  NotFoundError,
} from "@showzy/core/errors";
import { companyCustomers } from "@showzy/db/schema/customers";
import {
  candidatesContainingQuery,
  formatReferenceConflictMessage,
  normalizeReferenceQuery,
  pickUniqueNormalizedMatch,
  REFERENCE_CONFLICT_LABELS_MAX,
} from "@showzy/validation/entity-ref";
import {
  likeContainsPattern,
  sanitizeLikeLiteral,
} from "@showzy/validation/pagination";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { resolveCustomerReferenceContract } from "./resolve-customer-reference.contract.js";

const RESOLVE_CUSTOMER_CANDIDATE_MAX = 100;

type CustomerCandidate = {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
};

const candidateColumns = {
  id: companyCustomers.id,
  name: companyCustomers.name,
  phone: companyCustomers.phone,
  email: companyCustomers.email,
};

function customerMatchFields(
  row: CustomerCandidate,
): readonly (string | null)[] {
  return [row.name, row.phone, row.email];
}

function phoneLastDigits(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) {
    return undefined;
  }
  return digits.slice(-4);
}

function customerConflictLabel(row: CustomerCandidate): string {
  const lastDigits =
    row.phone === null ? undefined : phoneLastDigits(row.phone);
  if (lastDigits !== undefined) {
    return `${row.name} (…${lastDigits})`;
  }
  if (row.email !== null && row.email.length > 0) {
    return `${row.name} (${row.email})`;
  }
  return row.name;
}

function conflictFromCandidates(
  query: string,
  rows: readonly CustomerCandidate[],
): ConflictError {
  const labels = [...rows]
    .map(customerConflictLabel)
    .toSorted((left, right) => left.localeCompare(right))
    .slice(0, REFERENCE_CONFLICT_LABELS_MAX);
  return new ConflictError(formatReferenceConflictMessage(query, labels));
}

function fieldMatch(pattern: string): SQL {
  const clause = or(
    ilike(companyCustomers.name, pattern),
    ilike(companyCustomers.phone, pattern),
    ilike(companyCustomers.email, pattern),
  );
  if (clause === undefined) {
    throw new CoreInvariantError(
      "customers.resolveCustomerReference field match is empty",
    );
  }
  return clause;
}

function mergeCustomerCandidates(
  primary: readonly CustomerCandidate[],
  extra: readonly CustomerCandidate[],
): CustomerCandidate[] {
  const byId = new Map<string, CustomerCandidate>();
  for (const row of primary) {
    byId.set(row.id, row);
  }
  for (const row of extra) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

export const resolveCustomerReference = implementAction(
  resolveCustomerReferenceContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "customers.resolveCustomerReference expects staff",
        );
      }

      if (input.by === "id") {
        const row = (
          await ctx.db
            .select(candidateColumns)
            .from(companyCustomers)
            .where(
              and(
                eq(companyCustomers.companyId, ctx.companyId),
                eq(companyCustomers.id, input.id),
              ),
            )
            .limit(1)
        )[0];
        if (row === undefined) {
          throw new NotFoundError();
        }
        const name = row.name.trim();
        if (name.length === 0) {
          throw new CoreInvariantError(
            "customers.resolveCustomerReference id-path name is empty",
          );
        }
        return { customerId: row.id, name };
      }

      const normalized = normalizeReferenceQuery(input.value);
      const exactPattern = sanitizeLikeLiteral(normalized);
      const containsPattern = likeContainsPattern(normalized);
      if (exactPattern === undefined || containsPattern === undefined) {
        throw new NotFoundError();
      }

      const activeInCompany = and(
        eq(companyCustomers.companyId, ctx.companyId),
        eq(companyCustomers.status, "active"),
      );
      const [exactRows, containsRows] = await Promise.all([
        ctx.db
          .select(candidateColumns)
          .from(companyCustomers)
          .where(and(activeInCompany, fieldMatch(exactPattern))),
        ctx.db
          .select(candidateColumns)
          .from(companyCustomers)
          .where(and(activeInCompany, fieldMatch(containsPattern)))
          .orderBy(desc(companyCustomers.updatedAt), desc(companyCustomers.id))
          .limit(RESOLVE_CUSTOMER_CANDIDATE_MAX),
      ]);
      const candidates = mergeCustomerCandidates(exactRows, containsRows);

      const scoped = candidatesContainingQuery(
        input.value,
        candidates,
        customerMatchFields,
      );
      const picked = pickUniqueNormalizedMatch(
        input.value,
        scoped,
        customerMatchFields,
      );
      if (picked.kind === "none") {
        throw new NotFoundError();
      }
      if (picked.kind === "ambiguous") {
        throw conflictFromCandidates(input.value, picked.rows);
      }

      const name = picked.row.name.trim();
      if (name.length === 0) {
        throw new CoreInvariantError(
          "customers.resolveCustomerReference query-path name is empty",
        );
      }
      return { customerId: picked.row.id, name };
    },
  },
);
