/**
 * Staff cancel (SHO-210 / orders-T4). Status-only, copied from
 * `orders.confirm` (ADR-0026): `new` or `confirmed` → `canceled`. No stock,
 * no line edits, no `canceled_at`.
 *
 * Mechanical: `timeout: 5000` matches confirm in this slice.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

export const cancelOrderInputSchema = z.object({
  orderId: z.uuid(),
});

export const cancelOrderOutputSchema = z.object({
  orderId: z.uuid(),
  customerId: z.uuid().nullable(),
  status: z.literal("canceled"),
});

export const cancelOrderContract = defineActionContract({
  name: "orders.cancel",
  description:
    "Cancel a new or confirmed staff-intake order in the active company. Cancellation is a status transition only: the order moves to canceled. Already canceled orders fail with conflict. Missing or foreign-company orders fail with not-found.",
  principal: "staff",
  transport: "client",
  input: cancelOrderInputSchema,
  output: cancelOrderOutputSchema,
  permissions: ["orders:edit"],
  aiExposure: "exposed",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: ["orders.canceled"],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
});
