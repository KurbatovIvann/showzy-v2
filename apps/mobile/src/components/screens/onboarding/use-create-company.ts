import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useAuthSession } from "../../../auth/session-provider";
import { onboardingCopy } from "../../../i18n/onboarding";
import { detectLocale } from "../../../i18n/locale";
import {
  applyCreatedCompany,
  mapCreateCompanyFailure,
  nextLastSubmitted,
  planCreateCompanySubmit,
  resolveCreateCompanyCopy,
  shouldApplyCreatedCompany,
  type CreateCompanyFieldErrors,
  type CreateCompanyInput,
} from "./create-company-form";
import { bindCreateCompanyMutate } from "./create-company-mutation";
import { nextSlugAfterNameChange, sanitizeSlugInput } from "./suggest-slug";

const EMPTY_ERRORS: CreateCompanyFieldErrors = { name: null, slug: null };

export function useCreateCompany() {
  const copy = useMemo(() => onboardingCopy(detectLocale()), []);
  const auth = useAuthSession();
  const authRef = useRef(auth);
  authRef.current = auth;
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const { setActiveCompany } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [clientErrors, setClientErrors] =
    useState<CreateCompanyFieldErrors>(EMPTY_ERRORS);
  const [lastSubmitted, setLastSubmitted] = useState<CreateCompanyInput | null>(
    null,
  );

  const mutation = useContractMutation((input: CreateCompanyInput, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindCreateCompanyMutate(current)(input, options);
  });

  const failure = mutation.isError
    ? describeQueryFailure(mutation.error)
    : null;
  const wire = mutation.isError ? describeWireError(mutation.error) : null;
  const mapped = mapCreateCompanyFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const resolved = resolveCreateCompanyCopy(copy, {
    nameError: clientErrors.name,
    slugError: clientErrors.slug ?? mapped.slugError,
    banner: mapped.banner,
    pending: mutation.isPending,
    clientReady: apiClient !== null,
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
    if (mutation.isPending || apiClient === null) {
      return;
    }
    const plan = planCreateCompanySubmit({
      name,
      slug,
      lastSubmitted,
      lastFailureKind: failure?.kind ?? null,
      lastWireCode: wire?.code ?? null,
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
      if (
        !shouldApplyCreatedCompany({
          mounted: mountedRef.current,
          clientReady:
            apiRef.current !== null && authRef.current.session !== null,
        })
      ) {
        return;
      }
      const currentSession = authRef.current.session;
      if (currentSession === null) {
        return;
      }
      applyCreatedCompany({
        membership,
        sessionUserId: currentSession.userId,
        setActiveCompany,
        queryClient,
        enterPanel: () => {
          router.replace("/orders");
        },
      });
    } catch (error) {
      if (__DEV__) {
        const described = describeQueryFailure(error);
        console.info("[showzy/onboarding]", {
          kind: described.kind,
          wire: describeWireError(error)?.code ?? null,
          name: error instanceof Error ? error.name : typeof error,
          ...(error instanceof Error ? { message: error.message } : {}),
        });
      }
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
