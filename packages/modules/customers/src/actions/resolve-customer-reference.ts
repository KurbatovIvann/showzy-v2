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
import { likeContainsPattern } from "@showzy/validation/pagination";
import { and, desc, eq, ilike, or } from "drizzle-orm";

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

      const pattern = likeContainsPattern(normalizeReferenceQuery(input.value));
      if (pattern === undefined) {
        throw new NotFoundError();
      }

      const candidates = await ctx.db
        .select(candidateColumns)
        .from(companyCustomers)
        .where(
          and(
            eq(companyCustomers.companyId, ctx.companyId),
            eq(companyCustomers.status, "active"),
            or(
              ilike(companyCustomers.name, pattern),
              ilike(companyCustomers.phone, pattern),
              ilike(companyCustomers.email, pattern),
            ),
          ),
        )
        .orderBy(desc(companyCustomers.updatedAt), desc(companyCustomers.id))
        .limit(RESOLVE_CUSTOMER_CANDIDATE_MAX);

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
