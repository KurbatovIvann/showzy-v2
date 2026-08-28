/**
 * Price-list form copy keys, formState mapping, and server VALIDATION-by-path
 * mapping (SHO-190). Schema `message` values and issue paths are keys,
 * never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { PricingFormCopy } from "../../../i18n/pricing";
import type { PriceListFormMode } from "./price-list-form-draft";
import type { PriceListFormWrite } from "./price-list-form-plan";
import {
  isNameErrorKey,
  isPriceErrorKey,
  type NameErrorKey,
  type PriceErrorKey,
  type PriceListFormFieldErrors,
} from "./price-list-form.schema";

export type BannerKey =
  "validation" | "network" | "offline" | "unavailable" | "permission";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapPriceListFormFailure(
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

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: PriceListFormWrite | null,
): PriceListFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let name: NameErrorKey | null = null;
  for (const issue of error.data.issues) {
    const field = issue.path[0];
    if (field === "name") {
      name = "required";
    }
  }
  if (name === null) {
    return null;
  }
  return { name, entries: {} };
}

export type PriceListFormRhfErrorEntry = {
  readonly name: "name" | `entries.${number}.priceText`;
  readonly message: NameErrorKey | PriceErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: PriceListFormFieldErrors,
  entries: ReadonlyArray<{ readonly key: string }>,
): readonly PriceListFormRhfErrorEntry[] {
  const paths: PriceListFormRhfErrorEntry[] = [];
  if (errors.name !== null) {
    paths.push({ name: "name", message: errors.name });
  }
  for (const [key, message] of Object.entries(errors.entries)) {
    const index = entries.findIndex((entry) => entry.key === key);
    if (index < 0) {
      continue;
    }
    paths.push({
      name: `entries.${index}.priceText`,
      message,
    });
  }
  return paths;
}

export function entryMessagesFromRhfRows(
  entries: ReadonlyArray<{ readonly key: string }>,
  rhfEntries: unknown,
): Readonly<Record<string, unknown>> {
  const messages: Record<string, unknown> = {};
  if (!Array.isArray(rhfEntries)) {
    return messages;
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const row = rhfEntries[index];
    if (
      entry === undefined ||
      row === null ||
      typeof row !== "object" ||
      !("priceText" in row)
    ) {
      continue;
    }
    const priceText = row.priceText;
    if (
      priceText === null ||
      typeof priceText !== "object" ||
      !("message" in priceText)
    ) {
      continue;
    }
    messages[entry.key] = priceText.message;
  }
  return messages;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly entryMessages: Readonly<Record<string, unknown>>;
  readonly server: PriceListFormFieldErrors | null;
}): PriceListFormFieldErrors {
  const name =
    args.submitted &&
    typeof args.nameMessage === "string" &&
    isNameErrorKey(args.nameMessage)
      ? args.nameMessage
      : null;
  const entries: Record<string, PriceErrorKey> = {
    ...(args.server?.entries ?? {}),
  };
  if (args.submitted) {
    for (const [key, message] of Object.entries(args.entryMessages)) {
      if (typeof message === "string" && isPriceErrorKey(message)) {
        entries[key] = message;
      }
    }
  }
  return {
    name: name ?? args.server?.name ?? null,
    entries,
  };
}

function nameErrorCopy(
  copy: PricingFormCopy,
  key: NameErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.nameRequired;
  }
  if (key === "too_long") {
    return copy.errors.nameTooLong;
  }
  return null;
}

export function resolvePriceListFormCopy(
  copy: PricingFormCopy,
  args: {
    readonly mode: PriceListFormMode;
    readonly nameError: NameErrorKey | null;
    readonly hasPriceError: boolean;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
  },
): {
  readonly nameError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const banner =
    args.banner === null
      ? args.hasPriceError
        ? copy.errors.priceInvalid
        : null
      : copy.errors[args.banner];
  return {
    nameError: nameErrorCopy(copy, args.nameError),
    banner: args.clientReady ? banner : copy.errors.unavailable,
    submitLabel:
      args.mode === "create"
        ? args.pending
          ? copy.submitCreateLoading
          : copy.submitCreate
        : args.pending
          ? copy.submitEditLoading
          : copy.submitEdit,
    submitDisabled: args.pending || !args.clientReady,
    fieldsEditable: !args.pending && args.clientReady,
  };
}
