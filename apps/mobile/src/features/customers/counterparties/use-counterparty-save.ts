/**
 * Counterparty form save hook (SHO-196 / SHO-307). Single create/update
 * write — form-kit `useFormSave` / `runFormSave` fits.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { MutationCallOptions } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave } from "../../../components/form-kit";
import { bindCounterpartyFormMutate } from "../api/counterparty-form-mutation";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import type {
  CounterpartyFormDraft,
  CounterpartyFormFieldErrors,
  CounterpartyFormMode,
  CounterpartyFormSnapshot,
} from "./counterparty-form-draft";
import type { CounterpartyFormLoadState } from "./counterparty-form-load";
import {
  applyWriteSuccess,
  parseThenPlanCounterpartyFormSave,
  type CounterpartyFormMutationResult,
  type CounterpartyFormWrite,
} from "./counterparty-form-plan";

export { runCounterpartyFormSave } from "./counterparty-form-save";
export type {
  LastWriteFailure,
  CounterpartyFormSavePorts,
} from "./counterparty-form-save";

function bindCounterpartySave(
  client: ContractClient,
): (
  input: CounterpartyFormWrite,
  options: MutationCallOptions,
) => Promise<CounterpartyFormMutationResult> {
  return bindCounterpartyFormMutate(client);
}

export function useCounterpartySave(args: {
  readonly mode: CounterpartyFormMode;
  readonly loadKind: CounterpartyFormLoadState["kind"];
  readonly getDraft: () => CounterpartyFormDraft;
  readonly setDraft: (draft: CounterpartyFormDraft) => void;
  readonly setOrigin: (draft: CounterpartyFormDraft) => void;
  readonly counterpartyIdRef: { current: string | null };
  readonly baselineRef: { current: CounterpartyFormSnapshot | null };
  readonly setBaseline: (baseline: CounterpartyFormSnapshot | null) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: CounterpartyFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: CounterpartyFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useFormSave<
    CounterpartyFormDraft,
    CounterpartyFormWrite,
    CounterpartyFormMutationResult,
    CounterpartyFormFieldErrors
  >({
    bindMutate: bindCounterpartySave,
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
      const counterpartyId = args.counterpartyIdRef.current;
      return parseThenPlanCounterpartyFormSave({
        mode:
          counterpartyId !== null && args.mode === "create"
            ? "edit"
            : args.mode,
        counterpartyId,
        draft: args.getDraft(),
        baseline: args.baselineRef.current,
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      });
    },
    applySuccess: ({ draft, write, result }) => {
      if (write.kind === "createCounterparty") {
        args.counterpartyIdRef.current = result.id;
      }
      const applied = applyWriteSuccess({ draft, write });
      args.setDraft(applied.draft);
      args.baselineRef.current = applied.baseline;
      args.setBaseline(applied.baseline);
    },
    onSaved: () => args.onSaved(),
  });
}
