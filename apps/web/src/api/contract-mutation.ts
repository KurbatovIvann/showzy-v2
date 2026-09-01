/**
 * One `createMutationAttempt()` per logical submit. Retry reuses
 * `attempt.options`; a new submit mints a new key (contract.md §3).
 */
import {
  createMutationAttempt,
  type MutationAttempt,
  type MutationCallOptions,
} from "@showzy/contract";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";

export interface ContractMutationController<TInput, TOutput> {
  submit(input: TInput): Promise<TOutput>;
  retry(): Promise<TOutput>;
  attemptKey(): string | null;
  reset(): void;
}

export function createContractMutationController<TInput, TOutput>(deps: {
  readonly mutate: (
    input: TInput,
    options: MutationCallOptions,
  ) => Promise<TOutput>;
  readonly createAttempt?: () => MutationAttempt;
}): ContractMutationController<TInput, TOutput> {
  const startAttempt = deps.createAttempt ?? createMutationAttempt;
  let attempt: MutationAttempt | null = null;
  let lastInput: TInput | undefined;

  function requireInFlight(): {
    readonly attempt: MutationAttempt;
    readonly input: TInput;
  } {
    if (attempt === null || lastInput === undefined) {
      throw new Error("contract mutation has no in-flight submit");
    }
    return { attempt, input: lastInput };
  }

  return {
    async submit(input) {
      attempt = startAttempt();
      lastInput = input;
      return deps.mutate(input, attempt.options);
    },
    async retry() {
      const current = requireInFlight();
      return deps.mutate(current.input, current.attempt.options);
    },
    attemptKey: () => attempt?.key ?? null,
    reset() {
      attempt = null;
      lastInput = undefined;
    },
  };
}

type MutationRequest<TInput> =
  | { readonly kind: "submit"; readonly input: TInput }
  | { readonly kind: "retry" };

export function useContractMutation<TInput, TOutput>(
  mutate: (input: TInput, options: MutationCallOptions) => Promise<TOutput>,
) {
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  const controllerRef = useRef<ContractMutationController<
    TInput,
    TOutput
  > | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createContractMutationController({
      mutate: (input, options) => mutateRef.current(input, options),
    });
  }
  const controller = controllerRef.current;

  const mutation = useMutation({
    mutationFn: async (request: MutationRequest<TInput>): Promise<TOutput> => {
      switch (request.kind) {
        case "submit":
          return controller.submit(request.input);
        case "retry":
          return controller.retry();
      }
    },
    retry: 0,
  });

  return {
    submit: (input: TInput) => mutation.mutateAsync({ kind: "submit", input }),
    retry: () => mutation.mutateAsync({ kind: "retry" }),
    attemptKey: controller.attemptKey(),
    error: mutation.error,
    isPending: mutation.isPending,
    isError: mutation.isError,
    reset: () => {
      controller.reset();
      mutation.reset();
    },
  };
}
