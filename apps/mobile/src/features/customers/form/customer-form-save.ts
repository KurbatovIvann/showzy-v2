/**
 * Customer form save workflow (SHO-180 / SHO-307). Delegates to form-kit
 * `runFormSave`; create still stamps `customerId` in `applySuccess`.
 */
import {
  NO_SAVE_FAILURE,
  type LastWriteFailure,
} from "../../../components/form-kit/last-write-failure";
import { runFormSave } from "../../../components/form-kit/run-form-save";
import {
  type CustomerFormDraft,
  type CustomerFormFieldErrors,
  type CustomerFormMode,
  type CustomerFormSnapshot,
} from "./customer-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanCustomerFormSave,
  type CustomerFormMutationResult,
  type CustomerFormWrite,
} from "./customer-form-plan";

export { NO_SAVE_FAILURE, type LastWriteFailure };

export type CustomerFormSavePorts = {
  readonly getDraft: () => CustomerFormDraft;
  readonly getMode: () => CustomerFormMode;
  readonly getCustomerId: () => string | null;
  readonly setCustomerId: (customerId: string) => void;
  readonly getBaseline: () => CustomerFormSnapshot | null;
  readonly setDraft: (draft: CustomerFormDraft) => void;
  readonly setBaseline: (baseline: CustomerFormSnapshot | null) => void;
  readonly setOrigin: (draft: CustomerFormDraft) => void;
  readonly getLastWrite: () => CustomerFormWrite | null;
  readonly setLastWrite: (write: CustomerFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: CustomerFormFieldErrors) => void;
  readonly submit: (
    write: CustomerFormWrite,
  ) => Promise<CustomerFormMutationResult>;
  readonly retry: () => Promise<CustomerFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runCustomerFormSave(
  ports: CustomerFormSavePorts,
): Promise<void> {
  await runFormSave<
    CustomerFormDraft,
    CustomerFormWrite,
    CustomerFormMutationResult,
    CustomerFormFieldErrors
  >({
    plan: () => {
      const mode = ports.getMode();
      const customerId = ports.getCustomerId();
      return parseThenPlanCustomerFormSave({
        mode: customerId !== null && mode === "create" ? "edit" : mode,
        customerId,
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
      if (write.kind === "createCustomer") {
        ports.setCustomerId(result.id);
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
