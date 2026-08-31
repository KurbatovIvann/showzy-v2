/**
 * Generic mutation-wiring for `runFormSave` (SHO-300). Built on
 * `useBoundContractMutation` (SHO-297): apiRef, busy guard, mounted
 * saveBusy, lastWrite, lastFailure, invalidate-then-finish.
 */
import type { MutationCallOptions } from "@showzy/contract";
import { useEffect, useRef, useState } from "react";

import type { ContractClient } from "../../api/client";
import { describeQueryFailure, describeWireError } from "../../api/errors";
import { useBoundContractMutation } from "../../api/use-bound-contract-mutation";
import { NO_SAVE_FAILURE, type LastWriteFailure } from "./last-write-failure";
import { runFormSave, type FormSavePlan } from "./run-form-save";

export function useFormSave<Draft, Write, Result, FieldErrors>(args: {
  readonly bindMutate: (
    client: ContractClient,
  ) => (input: Write, options: MutationCallOptions) => Promise<Result>;
  readonly invalidate: () => Promise<void>;
  readonly ready: boolean;
  readonly getDraft: () => Draft;
  readonly setOrigin: (draft: Draft) => void;
  readonly setFieldErrors: (errors: FieldErrors) => void;
  readonly plan: (ctx: {
    readonly lastWrite: Write | null;
    readonly lastFailure: LastWriteFailure;
  }) => FormSavePlan<Write, FieldErrors>;
  readonly applySuccess?: (args: {
    readonly draft: Draft;
    readonly write: Write;
    readonly result: Result;
  }) => void;
  readonly onSaved: (result: Result | null) => Promise<void>;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: Write | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const mutation = useBoundContractMutation(args.bindMutate);
  const [saveBusy, setSaveBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState<Write | null>(null);
  const lastWriteRef = useRef<Write | null>(null);
  const lastFailureRef = useRef<LastWriteFailure>(NO_SAVE_FAILURE);
  const mountedRef = useRef(true);
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (!current.ready || mutation.apiClient === null) {
      return;
    }
    await mutation.runGuarded(async () => {
      if (mountedRef.current) {
        setSaveBusy(true);
      }
      try {
        await runFormSave({
          plan: () =>
            current.plan({
              lastWrite: lastWriteRef.current,
              lastFailure: lastFailureRef.current,
            }),
          getDraft: current.getDraft,
          setOrigin: current.setOrigin,
          getLastWrite: () => lastWriteRef.current,
          setLastWrite: (write) => {
            lastWriteRef.current = write;
            setLastWrite(write);
          },
          setLastFailure: (failure) => {
            lastFailureRef.current = failure;
          },
          setFieldErrors: current.setFieldErrors,
          submit: mutation.submit,
          retry: mutation.retry,
          resetMutation: mutation.reset,
          ...(current.applySuccess !== undefined
            ? { applySuccess: current.applySuccess }
            : {}),
          finish: async (result) => {
            await current.invalidate();
            await current.onSaved(result);
          },
        });
      } catch (error: unknown) {
        lastFailureRef.current = {
          kind: describeQueryFailure(error).kind,
          wire: describeWireError(error)?.code ?? null,
        };
      } finally {
        if (mountedRef.current) {
          setSaveBusy(false);
        }
      }
    });
  }

  return {
    save,
    pending: saveBusy || mutation.isPending,
    lastWrite,
    mutationError: mutation.error,
    isMutationError: mutation.isError,
    resetMutation: () => {
      lastFailureRef.current = NO_SAVE_FAILURE;
      mutation.reset();
    },
  };
}
