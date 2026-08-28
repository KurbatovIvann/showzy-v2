/**
 * Pricing write binders for the price-list form (SHO-190). One
 * `useContractMutation` attempt per write; the save loop fans out name,
 * default/active, then set/remove entry batches. UI drafts never go on
 * the wire: payloads are typed from `ContractClient` and parsed with
 * the action schemas.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CreatePriceListPayload,
  PriceListFormMutationResult,
  PriceListFormWrite,
  RemovePriceListEntriesPayload,
  SetPriceListEntriesPayload,
  UpdatePriceListPayload,
} from "../form/price-list-form-plan";
import {
  bindPriceListStatusMutate,
  type PriceListStatusTransport,
  type PriceListStatusWrite,
} from "./price-list-status";

type PricingWrites = {
  readonly createPriceList: (
    input: CreatePriceListPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
  readonly updatePriceList: (
    input: UpdatePriceListPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
  readonly setPriceListEntries: (
    input: SetPriceListEntriesPayload,
    options: MutationCallOptions,
  ) => Promise<unknown>;
  readonly removePriceListEntries: (
    input: RemovePriceListEntriesPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly priceListId: string }>;
} & PriceListStatusTransport["client"]["pricing"];

export type PriceListFormTransport = {
  readonly client: {
    readonly pricing: PricingWrites;
  };
};

function wireValidationFromIssues(
  issues: ReadonlyArray<{
    readonly code: string;
    readonly path: ReadonlyArray<PropertyKey>;
    readonly message: string;
  }>,
): Error {
  return Object.assign(new Error("Validation failed"), {
    code: "VALIDATION" as const,
    status: wireErrorStatus.VALIDATION,
    data: {
      issues: issues.map((issue) => ({
        code: issue.code,
        path: issue.path.filter(
          (part): part is string | number =>
            typeof part === "string" || typeof part === "number",
        ),
        message: issue.message,
      })),
    },
  });
}

function parseOrThrow<T>(
  parsed:
    | { success: true; data: T }
    | {
        success: false;
        error: {
          issues: ReadonlyArray<{
            readonly code: string;
            readonly path: ReadonlyArray<PropertyKey>;
            readonly message: string;
          }>;
        };
      },
): T {
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

function isStatusWrite(
  input: PriceListFormWrite,
): input is PriceListStatusWrite {
  return (
    input.kind === "setDefault" ||
    input.kind === "clearDefault" ||
    input.kind === "activate" ||
    input.kind === "deactivate"
  );
}

export function bindPriceListFormMutate(client: PriceListFormTransport) {
  const statusMutate = bindPriceListStatusMutate(client);
  return (
    input: PriceListFormWrite,
    options: MutationCallOptions,
  ): Promise<PriceListFormMutationResult> => {
    try {
      if (isStatusWrite(input)) {
        return statusMutate(input, options).then(() => ({
          id:
            input.kind === "setDefault"
              ? input.priceListId
              : input.kind === "clearDefault"
                ? ""
                : input.id,
        }));
      }
      switch (input.kind) {
        case "createPriceList": {
          const parsed = parseOrThrow(
            contractModules.pricing.createPriceList.input.safeParse(
              input.input,
            ),
          );
          return client.client.pricing
            .createPriceList(parsed, options)
            .then((output) => ({ id: output.id }));
        }
        case "updatePriceList": {
          const parsed = parseOrThrow(
            contractModules.pricing.updatePriceList.input.safeParse(
              input.input,
            ),
          );
          return client.client.pricing
            .updatePriceList(parsed, options)
            .then((output) => ({ id: output.id }));
        }
        case "setEntries": {
          const parsed = parseOrThrow(
            contractModules.pricing.setPriceListEntries.input.safeParse(
              input.input,
            ),
          );
          return client.client.pricing
            .setPriceListEntries(parsed, options)
            .then(() => ({ id: parsed.priceListId }));
        }
        case "removeEntries": {
          const parsed = parseOrThrow(
            contractModules.pricing.removePriceListEntries.input.safeParse(
              input.input,
            ),
          );
          return client.client.pricing
            .removePriceListEntries(parsed, options)
            .then((output) => ({ id: output.priceListId }));
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(
        new TypeError("price list form write parse failed"),
      );
    }
  };
}
