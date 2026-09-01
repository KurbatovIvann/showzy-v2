import { useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireCode } from "../../../api/errors";
import {
  emptyLegalDraft,
  emptyLegalErrors,
  mapLegalFailure,
  planOnboardingLegalSubmit,
  resolveLegalCopy,
  type OnboardingLegalDraft,
  type OnboardingLegalFieldErrors,
  type UpdateLegalInput,
} from "./legal-form";
import { bindUpdateLegalMutate } from "./update-legal-mutation";
import { useOnboardingCopy } from "./use-onboarding-copy";

export function useOnboardingLegalStep(args: {
  readonly onFinished: () => void;
}) {
  const copy = useOnboardingCopy();
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const onFinishedRef = useRef(args.onFinished);
  onFinishedRef.current = args.onFinished;

  const [draft, setDraft] = useState<OnboardingLegalDraft>(emptyLegalDraft);
  const [clientErrors, setClientErrors] =
    useState<OnboardingLegalFieldErrors>(emptyLegalErrors);
  const [lastSubmitted, setLastSubmitted] = useState<UpdateLegalInput | null>(
    null,
  );

  const mutation = useContractMutation((input: UpdateLegalInput, options) =>
    bindUpdateLegalMutate(apiRef.current)(input, options),
  );

  const failure = mutation.isError
    ? describeQueryFailure(mutation.error)
    : null;
  const wireCode = mutation.isError ? describeWireCode(mutation.error) : null;
  const resolved = resolveLegalCopy(copy, {
    errors: clientErrors,
    banner: mapLegalFailure(failure?.kind ?? null, wireCode),
    pending: mutation.isPending,
  });

  function patch(next: Partial<OnboardingLegalDraft>): void {
    setDraft((current) => ({ ...current, ...next }));
    setClientErrors(emptyLegalErrors());
    mutation.reset();
  }

  async function submit(): Promise<void> {
    if (mutation.isPending) {
      return;
    }
    const plan = planOnboardingLegalSubmit({
      draft,
      lastSubmitted,
      lastFailureKind: failure?.kind ?? null,
      lastWireCode: wireCode,
    });
    if (plan.kind === "invalid") {
      setClientErrors(plan.errors);
      return;
    }
    if (plan.kind === "submit") {
      setLastSubmitted(plan.input);
    }
    try {
      if (plan.kind === "retry") {
        await mutation.retry();
      } else {
        await mutation.submit(plan.input);
      }
      onFinishedRef.current();
    } catch {
      // Banner mapping comes from mutation.error.
    }
  }

  return {
    copy,
    draft,
    pending: mutation.isPending,
    legalNameError: resolved.legalNameError,
    edrpouError: resolved.edrpouError,
    legalAddressError: resolved.legalAddressError,
    ibanError: resolved.ibanError,
    bankNameError: resolved.bankNameError,
    bankMfoError: resolved.bankMfoError,
    banner: resolved.banner,
    submitLabel: resolved.submitLabel,
    submitDisabled: resolved.submitDisabled,
    fieldsEditable: resolved.fieldsEditable,
    patch,
    submit: () => {
      void submit();
    },
    skip: () => {
      if (!mutation.isPending) {
        onFinishedRef.current();
      }
    },
  };
}
