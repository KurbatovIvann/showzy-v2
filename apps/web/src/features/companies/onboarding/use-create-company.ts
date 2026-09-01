import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireCode } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { createBrowserCompanyPrefs } from "../../../prefs/companies/company-prefs";
import type { CompanyMembership } from "../api/list-mine";
import {
  applyCreatedCompany,
  mapCreateCompanyFailure,
  nextLastSubmitted,
  planCreateCompanySubmit,
  resolveCreateCompanyCopy,
  type CreateCompanyFieldErrors,
  type CreateCompanyInput,
} from "./create-company-form";
import { bindCreateCompanyMutate } from "./create-company-mutation";
import { nextSlugAfterNameChange, sanitizeSlugInput } from "./suggest-slug";
import { useOnboardingCopy } from "./use-onboarding-copy";

const EMPTY_ERRORS: CreateCompanyFieldErrors = { name: null, slug: null };

export function useCreateCompanyStep(args: {
  readonly onCreated: (membership: CompanyMembership) => void;
}) {
  const copy = useOnboardingCopy();
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { setActiveCompany } = useActiveCompany();
  const queryClient = useQueryClient();
  const onCreatedRef = useRef(args.onCreated);
  onCreatedRef.current = args.onCreated;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [clientErrors, setClientErrors] =
    useState<CreateCompanyFieldErrors>(EMPTY_ERRORS);
  const [lastSubmitted, setLastSubmitted] = useState<CreateCompanyInput | null>(
    null,
  );

  const mutation = useContractMutation((input: CreateCompanyInput, options) =>
    bindCreateCompanyMutate(apiRef.current)(input, options),
  );

  const failure = mutation.isError
    ? describeQueryFailure(mutation.error)
    : null;
  const wireCode = mutation.isError ? describeWireCode(mutation.error) : null;
  const mapped = mapCreateCompanyFailure(failure?.kind ?? null, wireCode);
  const resolved = resolveCreateCompanyCopy(copy, {
    nameError: clientErrors.name,
    slugError: clientErrors.slug ?? mapped.slugError,
    banner: mapped.banner,
    pending: mutation.isPending,
  });

  function changeName(value: string): void {
    setName(value);
    setSlug(
      nextSlugAfterNameChange({
        name: value,
        slugTouched,
        currentSlug: slug,
      }),
    );
    setClientErrors(EMPTY_ERRORS);
    mutation.reset();
  }

  function changeSlug(value: string): void {
    setSlugTouched(true);
    setSlug(sanitizeSlugInput(value));
    setClientErrors(EMPTY_ERRORS);
    mutation.reset();
  }

  async function submit(): Promise<void> {
    if (mutation.isPending) {
      return;
    }
    const plan = planCreateCompanySubmit({
      name,
      slug,
      lastSubmitted,
      lastFailureKind: failure?.kind ?? null,
      lastWireCode: wireCode,
    });
    if (plan.kind === "invalid") {
      setClientErrors(plan.errors);
      return;
    }
    setLastSubmitted(nextLastSubmitted(plan, lastSubmitted));
    try {
      const membership =
        plan.kind === "retry"
          ? await mutation.retry()
          : await mutation.submit(plan.input);
      onCreatedRef.current(membership);
      applyCreatedCompany({
        membership,
        setActiveCompany,
        rememberSlug: (nextSlug) => {
          createBrowserCompanyPrefs().setLastCompanySlug(nextSlug);
        },
        queryClient,
      });
    } catch {
      // Field/banner mapping comes from mutation.error.
    }
  }

  return {
    copy,
    name,
    slug,
    nameError: resolved.nameError,
    slugError: resolved.slugError,
    banner: resolved.banner,
    pending: mutation.isPending,
    submitDisabled: resolved.submitDisabled || name.trim().length === 0,
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable,
    changeName,
    changeSlug,
    submit: () => {
      void submit();
    },
  };
}
