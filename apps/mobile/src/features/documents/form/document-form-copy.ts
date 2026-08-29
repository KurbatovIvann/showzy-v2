/**
 * Document create copy keys, formState mapping, and server
 * VALIDATION-by-path mapping (SHO-238). Schema `message` values and
 * issue paths are keys, never user-facing text. Linked-customer mismatch
 * is a server VALIDATION — banner, not a field (do not invent a fifth
 * CRM writer).
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { DocumentsFormCopy } from "../../../i18n/documents";
import type { DocumentFormWrite } from "./document-form-plan";
import {
  isOrderErrorKey,
  type DocumentFormFieldErrors,
  type OrderErrorKey,
} from "./document-form.schema";

export type BannerKey =
  | "validation"
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "conflict";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapDocumentFormFailure(
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
  if (kind === "conflict") {
    return "conflict";
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

function issueField(path: IssuePath): "order" | null {
  const field = path[0];
  if (field === "orderId") {
    return "order";
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4). `counterpartyId` / mismatch gates
 * stay banner-only.
 */
export function mapValidationIssues(
  error: unknown,
  write: DocumentFormWrite | null,
): DocumentFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let order: OrderErrorKey | null = null;
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "order") {
      order = "required";
    }
  }
  if (order === null) {
    return null;
  }
  return { order };
}

export type DocumentFormRhfErrorEntry = {
  readonly name: "orderId";
  readonly message: OrderErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: DocumentFormFieldErrors,
): readonly DocumentFormRhfErrorEntry[] {
  const paths: DocumentFormRhfErrorEntry[] = [];
  if (errors.order !== null) {
    paths.push({ name: "orderId", message: errors.order });
  }
  return paths;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly orderMessage: unknown;
  readonly server: DocumentFormFieldErrors | null;
}): DocumentFormFieldErrors {
  const order =
    args.submitted &&
    typeof args.orderMessage === "string" &&
    isOrderErrorKey(args.orderMessage)
      ? args.orderMessage
      : null;
  return {
    order: order ?? args.server?.order ?? null,
  };
}

function orderErrorCopy(
  copy: DocumentsFormCopy,
  key: OrderErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.orderRequired;
  }
  return null;
}

export function resolveDocumentFormCopy(
  copy: DocumentsFormCopy,
  args: {
    readonly orderError: OrderErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
    readonly canCreate: boolean;
  },
): {
  readonly orderError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
  readonly showSubmit: boolean;
} {
  return {
    orderError: orderErrorCopy(copy, args.orderError),
    banner: args.clientReady
      ? args.banner === null
        ? null
        : copy.errors[args.banner]
      : copy.errors.unavailable,
    submitLabel: args.pending ? copy.submitCreateLoading : copy.submitCreate,
    submitDisabled: args.pending || !args.clientReady || !args.canCreate,
    fieldsEditable: !args.pending && args.clientReady && args.canCreate,
    showSubmit: args.canCreate,
  };
}
