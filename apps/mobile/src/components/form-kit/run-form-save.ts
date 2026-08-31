/**
 * Shared form save workflow (SHO-300). Parse/plan is a port; this loop
 * is parse → plan → gate → mutate → apply → reset → finish.
 *
 * Reconciled drift (pinned by tests):
 * - `resetMutation()` runs after `applySuccess` and before `finish`.
 * - `finish` is typed and receives the mutate `result` (null on noop).
 */
import { NO_SAVE_FAILURE, type LastWriteFailure } from "./last-write-failure";

export type FormSavePlan<Write, FieldErrors> =
  | { readonly kind: "invalid"; readonly errors: FieldErrors }
  | { readonly kind: "noop" }
  | { readonly kind: "retry" }
  | { readonly kind: "write"; readonly write: Write };

export type FormSavePorts<Draft, Write, Result, FieldErrors> = {
  readonly plan: () => FormSavePlan<Write, FieldErrors>;
  readonly getDraft: () => Draft;
  readonly setOrigin: (draft: Draft) => void;
  readonly getLastWrite: () => Write | null;
  readonly setLastWrite: (write: Write) => void;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: FieldErrors) => void;
  readonly submit: (write: Write) => Promise<Result>;
  readonly retry: () => Promise<Result>;
  readonly resetMutation: () => void;
  readonly finish: (result: Result | null) => Promise<void>;
  readonly applySuccess?: (args: {
    readonly draft: Draft;
    readonly write: Write;
    readonly result: Result;
  }) => void;
};

export async function runFormSave<Draft, Write, Result, FieldErrors>(
  ports: FormSavePorts<Draft, Write, Result, FieldErrors>,
): Promise<void> {
  const plan = ports.plan();
  if (plan.kind === "invalid") {
    ports.setFieldErrors(plan.errors);
    return;
  }
  if (plan.kind === "noop") {
    ports.setOrigin(ports.getDraft());
    await ports.finish(null);
    return;
  }
  if (plan.kind === "write") {
    ports.setLastWrite(plan.write);
  }
  const write = ports.getLastWrite();
  if (write === null) {
    return;
  }
  const result =
    plan.kind === "retry" ? await ports.retry() : await ports.submit(write);
  ports.setLastFailure(NO_SAVE_FAILURE);
  ports.applySuccess?.({
    draft: ports.getDraft(),
    write,
    result,
  });
  ports.resetMutation();
  ports.setOrigin(ports.getDraft());
  await ports.finish(result);
}
