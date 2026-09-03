/**
 * Per-id CRM hydration for order detail. Pending and non-NOT_FOUND
 * query failures are not "deleted" — only a null customerId, settled
 * NOT_FOUND, or a blank name maps to missing-customer copy.
 */
export type CustomerNameHydration =
  | { readonly kind: "pending" }
  | { readonly kind: "missing" }
  | { readonly kind: "ready"; readonly name: string };

export function resolveCustomerNameHydration(args: {
  readonly customerId: string | null;
  readonly name: string | undefined;
  readonly status: "pending" | "error" | "success";
  readonly notFound: boolean;
}): CustomerNameHydration {
  if (args.customerId === null) {
    return { kind: "missing" };
  }
  const name = args.name?.trim();
  if (name !== undefined && name.length > 0) {
    return { kind: "ready", name };
  }
  if (args.notFound || args.status === "success") {
    return { kind: "missing" };
  }
  return { kind: "pending" };
}

export function customerNameLabel(
  hydration: CustomerNameHydration,
  fallback: string,
): string {
  if (hydration.kind === "ready") {
    return hydration.name;
  }
  if (hydration.kind === "missing") {
    return fallback;
  }
  return "";
}
