/**
 * Internal CRM reference resolve for `orders.create` (SHO-352 / ADR-0033).
 * Exact normalized unique match may write; contains-only hits become
 * CONFLICT labels and never auto-choose. Query-path is active only; id-path
 * may still target archived rows (current getCustomer behavior).
 *
 * Mechanical: `timeout: 5000` matches other customers facts reads. Query
 * max 100. Conflict labels cap 5 with phone-last-digits or email
 * discriminators. No notes. Company id is never input.
 */
import { defineActionContract } from "@showzy/core/contract";
import {
  ENTITY_REF_QUERY_MAX,
  entityRefSchema,
} from "@showzy/validation/entity-ref";
import { z } from "zod";

export const RESOLVE_CUSTOMER_REFERENCE_QUERY_MAX = ENTITY_REF_QUERY_MAX;

export const resolveCustomerReferenceInputSchema = entityRefSchema;

export const resolveCustomerReferenceOutputSchema = z.strictObject({
  customerId: z.uuid(),
  name: z.string().min(1),
});

export const resolveCustomerReferenceContract = defineActionContract({
  name: "customers.resolveCustomerReference",
  description:
    "Resolve one CRM customer in the staff member's active company from a canonical id or a unique human query (name, phone, or email). Query matches are active customers only. An id may still target an archived row. Zero matches are not-found. Ambiguous matches return conflict with at most five tenant-safe labels. Company id is never input. Does not return notes.",
  principal: "staff",
  transport: "internal",
  input: resolveCustomerReferenceInputSchema,
  output: resolveCustomerReferenceOutputSchema,
  permissions: ["customers:view"],
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
});
