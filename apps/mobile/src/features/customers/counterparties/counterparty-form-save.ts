/**
 * Counterparty form save workflow (SHO-196 / SHO-307). Delegates to
 * form-kit `runFormSave`; create still stamps `counterpartyId`.
 */
import {
  NO_SAVE_FAILURE,
  type LastWriteFailure,
} from "../../../components/form-kit/last-write-failure";
import { runFormSave } from "../../../components/form-kit/run-form-save";
import {
  type CounterpartyFormDraft,
  type CounterpartyFormFieldErrors,
  type CounterpartyFormMode,
  type CounterpartyFormSnapshot,
} from "./counterparty-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanCounterpartyFormSave,
  type CounterpartyFormMutationResult,
  type CounterpartyFormWrite,
} from "./counterparty-form-plan";

export { NO_SAVE_FAILURE, type LastWriteFailure };

export type CounterpartyFormSavePorts = {
  readonly getDraft: () => CounterpartyFormDraft;
  readonly getMode: () => CounterpartyFormMode;
  readonly getCounterpartyId: () => string | null;
  readonly setCounterpartyId: (counterpartyId: string) => void;
  readonly getBaseline: () => CounterpartyFormSnapshot | null;
  readonly setDraft: (draft: CounterpartyFormDraft) => void;
  readonly setBaseline: (baseline: CounterpartyFormSnapshot | null) => void;
  readonly setOrigin: (draft: CounterpartyFormDraft) => void;
  readonly getLastWrite: () => CounterpartyFormWrite | null;
  readonly setLastWrite: (write: CounterpartyFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: CounterpartyFormFieldErrors) => void;
  readonly submit: (
    write: CounterpartyFormWrite,
  ) => Promise<CounterpartyFormMutationResult>;
  readonly retry: () => Promise<CounterpartyFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runCounterpartyFormSave(
  ports: CounterpartyFormSavePorts,
): Promise<void> {
  await runFormSave<
    CounterpartyFormDraft,
    CounterpartyFormWrite,
    CounterpartyFormMutationResult,
    CounterpartyFormFieldErrors
  >({
    plan: () => {
      const mode = ports.getMode();
      const counterpartyId = ports.getCounterpartyId();
      return parseThenPlanCounterpartyFormSave({
        mode: counterpartyId !== null && mode === "create" ? "edit" : mode,
        counterpartyId,
        draft: ports.getDraft(),
        baseline: ports.getBaseline(),
        lastWrite: ports.getLastWrite(),
        lastFailureKind: ports.getLastFailure().kind,
        lastWireCode: ports.getLastFailure().wire,
      });
    },
    getDraft: ports.getDraft,
    setOrigin: ports.setOrigin,
    getLastWrite: ports.getLastWrite,
    setLastWrite: ports.setLastWrite,
    setLastFailure: ports.setLastFailure,
    setFieldErrors: ports.setFieldErrors,
    submit: ports.submit,
    retry: ports.retry,
    resetMutation: ports.resetMutation,
    applySuccess: ({ draft, write, result }) => {
      if (write.kind === "createCounterparty") {
        ports.setCounterpartyId(result.id);
      }
      const applied = applyWriteSuccess({
        draft,
        write,
      });
      ports.setDraft(applied.draft);
      ports.setBaseline(applied.baseline);
    },
    finish: async () => {
      await ports.finish();
    },
  });
}
