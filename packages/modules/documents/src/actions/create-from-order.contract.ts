/**
 * Staff write `documents.createFromOrder` (SHO-231 / feature SHO-227).
 * Copy `orders.create` (golden write). Mechanical choices the feature card
 * left unnamed:
 * - Output is the created document view (snapshots + items) so the client
 *   has the issued row without a second round-trip. Later `documents.get`
 *   will reuse `documentViewSchema`.
 * - `timeout: 15000` covers nested `orders.get` (2000) +
 *   `companies.getSellerFacts` (5000) + one of `customers.getCounterparty`
 *   / `customers.getCustomer` (5000) sharing the remaining budget, then
 *   the write.
 * - `template_name` snapshots the system layout id equal to `type`
 *   (`payment_invoice` | `delivery_note`) — not an FK; TSX layouts land
 *   in doc-generation-T2.
 * - Input is a strict object so `companyId` cannot be smuggled in
 *   (ADR-0013).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import {
  documentTypeSchema,
  documentViewSchema,
} from "./document-view.contract.js";

export const createFromOrderInputSchema = z.strictObject({
  orderId: z.uuid(),
  type: documentTypeSchema,
  counterpartyId: z.uuid().optional(),
});

export const createFromOrderOutputSchema = documentViewSchema;

export const createFromOrderContract = defineActionContract({
  name: "documents.createFromOrder",
  description:
    "Issue a payment invoice or delivery note from a staff order in the active company. Copies immutable order line snapshots (no reprice); snapshots seller legal requisites from getSellerFacts and the buyer as either a counterparty legal face or the CRM customer display name. Assigns the next per-type document number (prefix, type code, sequence — no year) and the Europe/Kyiv calendar day. Fails when the order is canceled, seller legal is missing, a live document of that type already exists for the order, the counterparty is linked to a different customer, or the order has no customer and no counterparty.",
  principal: "staff",
  transport: "client",
  input: createFromOrderInputSchema,
  output: createFromOrderOutputSchema,
  permissions: ["documents:create"],
  aiExposure: "exposed",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: ["documents.created"],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 15_000,
});
