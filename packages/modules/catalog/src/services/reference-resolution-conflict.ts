/**
 * Catalog-owned structured conflict for order-line variant and product
 * selection (SHO-405 / SHO-410 / SHO-401 / SHO-440). Wire code stays CONFLICT —
 * no new core error class.
 */
import { ConflictError } from "@showzy/core/errors";

export const REFERENCE_RESOLUTION_CONFLICT_REASONS = [
  "variant_required",
  "ambiguous",
  "unmatched_query",
  "no_active_variants",
  "archived",
] as const;

export type ReferenceResolutionConflictReason =
  (typeof REFERENCE_RESOLUTION_CONFLICT_REASONS)[number];

export type OrderLineVariantTarget = {
  readonly kind: "order_line_variant";
  readonly lineIndex: number;
  readonly productId: string;
  readonly productName: string;
};

export type OrderLineProductTarget = {
  readonly kind: "order_line_product";
  readonly lineIndex: number;
  readonly query: string;
  /** Canonical name when exactly one archived product is identified. */
  readonly productName?: string;
};

export type ReferenceResolutionTarget =
  OrderLineVariantTarget | OrderLineProductTarget;

export type VariantSelectionOption = {
  readonly id: string;
  readonly label: string;
};

export class ReferenceResolutionConflictError extends ConflictError {
  readonly reason: ReferenceResolutionConflictReason;
  readonly target: ReferenceResolutionTarget;
  readonly options: readonly VariantSelectionOption[];
  readonly optionsTruncated: boolean;

  constructor(args: {
    readonly reason: ReferenceResolutionConflictReason;
    readonly target: ReferenceResolutionTarget;
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

export function ambiguousProductQueryMessage(query: string): string {
  return `Select a product matching "${query}".`;
}

export function archivedProductMessage(productName: string): string {
  return `"${productName}" is archived.`;
}

export function archivedProductQueryMessage(query: string): string {
  return `No active product matched "${query}"; matching products are archived.`;
}
