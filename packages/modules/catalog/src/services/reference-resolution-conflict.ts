/**
 * Catalog-owned structured conflict for order-line variant selection
 * (SHO-405 / SHO-401). Wire code stays CONFLICT — no new core error class.
 */
import { ConflictError } from "@showzy/core/errors";

export const REFERENCE_RESOLUTION_CONFLICT_REASONS = [
  "variant_required",
  "ambiguous",
  "unmatched_query",
  "no_active_variants",
] as const;

export type ReferenceResolutionConflictReason =
  (typeof REFERENCE_RESOLUTION_CONFLICT_REASONS)[number];

export type OrderLineVariantTarget = {
  readonly kind: "order_line_variant";
  readonly lineIndex: number;
  readonly productId: string;
  readonly productName: string;
};

export type VariantSelectionOption = {
  readonly id: string;
  readonly label: string;
};

export class ReferenceResolutionConflictError extends ConflictError {
  readonly reason: ReferenceResolutionConflictReason;
  readonly target: OrderLineVariantTarget;
  readonly options: readonly VariantSelectionOption[];
  readonly optionsTruncated: boolean;

  constructor(args: {
    readonly reason: ReferenceResolutionConflictReason;
    readonly target: OrderLineVariantTarget;
    readonly options: readonly VariantSelectionOption[];
    readonly optionsTruncated: boolean;
    readonly clientMessage: string;
  }) {
    super(args.clientMessage);
    this.reason = args.reason;
    this.target = args.target;
    this.options = args.options;
    this.optionsTruncated = args.optionsTruncated;
  }
}

export function variantRequiredMessage(productName: string): string {
  return `Select a variant for "${productName}".`;
}

export function noActiveVariantsMessage(productName: string): string {
  return `"${productName}" has no active variants.`;
}

export function unmatchedVariantQueryMessage(
  query: string,
  productName: string,
): string {
  return `No variant matched "${query}" for "${productName}".`;
}

export function ambiguousVariantQueryMessage(
  query: string,
  productName: string,
): string {
  return `Multiple variants matched "${query}" for "${productName}".`;
}
