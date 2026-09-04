/**
 * Order create copy keys, formState mapping, and server VALIDATION-by-path
 * mapping (SHO-379). Schema `message` values and issue paths are keys,
 * never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import {
  describeQueryFailure,
  type QueryFailureKind,
} from "../../../api/errors";
import type { OrdersCreateCopy } from "../../../i18n/orders";
import type { OrderFormWrite } from "./order-form-plan";
import {
  emptyFieldErrors,
  isCommentErrorKey,
  isCustomerErrorKey,
  isItemsErrorKey,
  type CommentErrorKey,
  type CustomerErrorKey,
  type ItemsErrorKey,
  type OrderFormFieldErrors,
} from "./order-form.schema";

export type BannerKey =
  | "validation"
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "duplicate"
  | "too_many";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapOrderFormFailure(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): BannerKey | null {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return "unavailable";
  }
  if (kind === null) {
    return null;
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "validation") {
    return "validation";
  }
  if (kind === "network") {
    return "network";
  }
  if (kind === "offline") {
    return "offline";
  }
  return "unavailable";
}

type IssuePath = ReadonlyArray<string | number>;

function issueField(path: IssuePath): "customer" | "items" | "comment" | null {
  const field = path[0];
  if (field === "customer" || field === "customerId") {
    return "customer";
  }
  if (field === "items") {
    return "items";
  }
  if (field === "comment") {
    return "comment";
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: OrderFormWrite | null,
): OrderFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let customer: CustomerErrorKey | null = null;
  let items: ItemsErrorKey | null = null;
  let comment: CommentErrorKey | null = null;
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "customer") {
      customer = "required";
    }
    if (field === "items") {
      items = "required";
    }
    if (field === "comment") {
      comment = "too_long";
    }
  }
  if (customer === null && items === null && comment === null) {
    return null;
  }
  return { customer, items, comment };
}

export type OrderFormRhfErrorEntry = {
  readonly name: "customerId" | "items" | "comment";
  readonly message: CustomerErrorKey | ItemsErrorKey | CommentErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: OrderFormFieldErrors,
): readonly OrderFormRhfErrorEntry[] {
  const paths: OrderFormRhfErrorEntry[] = [];
  if (errors.customer !== null) {
    paths.push({ name: "customerId", message: errors.customer });
  }
  if (errors.items !== null) {
    paths.push({ name: "items", message: errors.items });
  }
  if (errors.comment !== null) {
    paths.push({ name: "comment", message: errors.comment });
  }
  return paths;
}

/** RHF array refine errors live on `message` or `root.message`. */
export function rhfItemsMessage(itemsError: unknown): string | undefined {
  if (itemsError === null || itemsError === undefined) {
    return undefined;
  }
  if (typeof itemsError !== "object") {
    return undefined;
  }
  if ("message" in itemsError && typeof itemsError.message === "string") {
    return itemsError.message;
  }
  if (
    "root" in itemsError &&
    itemsError.root !== null &&
    typeof itemsError.root === "object" &&
    "message" in itemsError.root &&
    typeof itemsError.root.message === "string"
  ) {
    return itemsError.root.message;
  }
  return undefined;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly customerMessage: unknown;
  readonly itemsMessage: unknown;
  readonly commentMessage: unknown;
  readonly planner: OrderFormFieldErrors | null;
  readonly server: OrderFormFieldErrors | null;
}): OrderFormFieldErrors {
  const customer =
    args.submitted &&
    typeof args.customerMessage === "string" &&
    isCustomerErrorKey(args.customerMessage)
      ? args.customerMessage
      : null;
  const items =
    args.submitted &&
    typeof args.itemsMessage === "string" &&
    isItemsErrorKey(args.itemsMessage)
      ? args.itemsMessage
      : null;
  const comment =
    args.submitted &&
    typeof args.commentMessage === "string" &&
    isCommentErrorKey(args.commentMessage)
      ? args.commentMessage
      : null;
  return {
    customer:
      customer ?? args.planner?.customer ?? args.server?.customer ?? null,
    items: items ?? args.planner?.items ?? args.server?.items ?? null,
    comment: comment ?? args.planner?.comment ?? args.server?.comment ?? null,
  };
}

function customerErrorCopy(
  copy: OrdersCreateCopy,
  key: CustomerErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.customerRequired;
  }
  return null;
}

function itemsErrorCopy(
  copy: OrdersCreateCopy,
  key: ItemsErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.itemsRequired;
  }
  if (key === "duplicate") {
    return copy.errors.itemsDuplicate;
  }
  if (key === "too_many") {
    return copy.errors.itemsTooMany;
  }
  if (key === "variant_required") {
    return copy.errors.itemsVariantRequired;
  }
  if (key === "no_active_variants") {
    return copy.errors.itemsNoActiveVariants;
  }
  return null;
}

function conflictReasonFromUnknown(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  if ("reason" in error && typeof error.reason === "string") {
    return error.reason;
  }
  if (
    !("data" in error) ||
    typeof error.data !== "object" ||
    error.data === null
  ) {
    return null;
  }
  if ("reason" in error.data && typeof error.data.reason === "string") {
    return error.data.reason;
  }
  return null;
}

/**
 * Domain variant-selection CONFLICT (SHO-408). Maps structured `reason`
 * when present; a bare wire `CONFLICT` (contract `toWireError` omits
 * `reason`) still lands on the variant picker so a stale selection is
 * not a generic dead-end. Never matches `error.message` text.
 */
export function mapVariantSelectionConflict(
  error: unknown,
): OrderFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "CONFLICT") {
    return null;
  }
  const reason = conflictReasonFromUnknown(error);
  if (reason === "no_active_variants") {
    return { ...emptyFieldErrors(), items: "no_active_variants" };
  }
  if (reason === "customer_not_found") {
    return { ...emptyFieldErrors(), customer: "required" };
  }
  if (reason === "product_not_found") {
    return { ...emptyFieldErrors(), items: "required" };
  }
  return { ...emptyFieldErrors(), items: "variant_required" };
}

function commentErrorCopy(
  copy: OrdersCreateCopy,
  key: CommentErrorKey | null,
): string | null {
  if (key === "too_long") {
    return copy.errors.commentTooLong;
  }
  return null;
}

function bannerCopy(
  copy: OrdersCreateCopy,
  banner: BannerKey | null,
): string | null {
  if (banner === null) {
    return null;
  }
  if (banner === "duplicate") {
    return copy.errors.itemsDuplicate;
  }
  if (banner === "too_many") {
    return copy.errors.itemsTooMany;
  }
  return copy.errors[banner];
}

/**
 * List-query picker failures. Discriminate on `error.code` via
 * `describeQueryFailure` — never `error.message`. Do not reuse the
 * empty-catalog copy.
 */
export function mapLookupListError(
  copy: OrdersCreateCopy,
  error: unknown,
  surface: "customers" | "products",
): string | null {
  if (error === null || error === undefined) {
    return null;
  }
  const kind = describeQueryFailure(error).kind;
  if (kind === "network") {
    return copy.errors.network;
  }
  if (kind === "offline") {
    return copy.errors.offline;
  }
  return surface === "customers" ? copy.customersError : copy.productsError;
}

export function resolveOrderFormCopy(
  copy: OrdersCreateCopy,
  args: {
    readonly customerError: CustomerErrorKey | null;
    readonly itemsError: ItemsErrorKey | null;
    readonly commentError: CommentErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
    readonly canCreate: boolean;
  },
): {
  readonly customerError: string | null;
  readonly itemsError: string | null;
  readonly commentError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
  readonly showSubmit: boolean;
} {
  return {
    customerError: customerErrorCopy(copy, args.customerError),
    itemsError: itemsErrorCopy(copy, args.itemsError),
    commentError: commentErrorCopy(copy, args.commentError),
    banner: args.clientReady
      ? bannerCopy(copy, args.banner)
      : copy.errors.unavailable,
    submitLabel: args.pending ? copy.submitCreateLoading : copy.submitCreate,
    submitDisabled: args.pending || !args.clientReady || !args.canCreate,
    fieldsEditable: !args.pending && args.clientReady && args.canCreate,
    showSubmit: args.canCreate,
  };
}
