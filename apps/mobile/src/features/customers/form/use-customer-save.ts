/**
 * Customer form save hook (SHO-180 / SHO-307). Single create/update
 * write — form-kit `useFormSave` / `runFormSave` fits.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { MutationCallOptions } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave } from "../../../components/form-kit";
import { bindCustomerFormMutate } from "../api/customer-form-mutation";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import type {
  CustomerFormDraft,
  CustomerFormFieldErrors,
  CustomerFormMode,
  CustomerFormSnapshot,
} from "./customer-form-draft";
import type { CustomerFormLoadState } from "./customer-form-load";
import {
  applyWriteSuccess,
  parseThenPlanCustomerFormSave,
  type CustomerFormMutationResult,
  type CustomerFormWrite,
} from "./customer-form-plan";

export { runCustomerFormSave } from "./customer-form-save";
export type {
  LastWriteFailure,
  CustomerFormSavePorts,
} from "./customer-form-save";

function bindCustomerSave(
  client: ContractClient,
): (
  input: CustomerFormWrite,
  options: MutationCallOptions,
) => Promise<CustomerFormMutationResult> {
  return bindCustomerFormMutate(client);
}

export function useCustomerSave(args: {
  readonly mode: CustomerFormMode;
  readonly loadKind: CustomerFormLoadState["kind"];
  readonly getDraft: () => CustomerFormDraft;
  readonly setDraft: (draft: CustomerFormDraft) => void;
  readonly setOrigin: (draft: CustomerFormDraft) => void;
  readonly customerIdRef: { current: string | null };
  readonly baselineRef: { current: CustomerFormSnapshot | null };
  readonly setBaseline: (baseline: CustomerFormSnapshot | null) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: CustomerFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: CustomerFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useFormSave<
    CustomerFormDraft,
    CustomerFormWrite,
    CustomerFormMutationResult,
    CustomerFormFieldErrors
  >({
    bindMutate: bindCustomerSave,
    invalidate: () =>
      invalidateCustomersAfterWrite({
        queryClient,
        companyId: activeCompanyId,
      }),
    ready: args.loadKind === "ready",
    getDraft: args.getDraft,
    setOrigin: args.setOrigin,
    setFieldErrors: args.setFieldErrors,
    plan: ({ lastWrite, lastFailure }) => {
      const customerId = args.customerIdRef.current;
      return parseThenPlanCustomerFormSave({
        mode:
          customerId !== null && args.mode === "create" ? "edit" : args.mode,
        customerId,
        draft: args.getDraft(),
        baseline: args.baselineRef.current,
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      });
    },
    applySuccess: ({ draft, write, result }) => {
      if (write.kind === "createCustomer") {
        args.customerIdRef.current = result.id;
      }
      const applied = applyWriteSuccess({ draft, write });
      args.setDraft(applied.draft);
      args.baselineRef.current = applied.baseline;
      args.setBaseline(applied.baseline);
    },
    onSaved: () => args.onSaved(),
  });
}
