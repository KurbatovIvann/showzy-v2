/**
 * Company legal form save hook (SHO-225). Wraps `runCompanyLegalFormSave`
 * with `useContractMutation` and `companies.get` invalidation + leave-arm
 * callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { invalidateCompanyAfterWrite } from "../api/company-cache";
import { bindCompanyLegalFormMutate } from "../api/company-legal-form-mutation";
import type {
  CompanyLegalFormDraft,
  CompanyLegalFormFieldErrors,
  CompanyLegalFormMode,
  CompanyLegalFormSnapshot,
} from "./company-legal-form-draft";
import type { CompanyLegalFormLoadState } from "./company-legal-form-load";
import type { CompanyLegalFormWrite } from "./company-legal-form-plan";
import {
  NO_SAVE_FAILURE,
  runCompanyLegalFormSave,
  type LastWriteFailure,
} from "./company-legal-form-save";

export { runCompanyLegalFormSave } from "./company-legal-form-save";
export type {
  LastWriteFailure,
  CompanyLegalFormSavePorts,
} from "./company-legal-form-save";

export function useCompanyLegalSave(args: {
  readonly mode: CompanyLegalFormMode;
  readonly loadKind: CompanyLegalFormLoadState["kind"];
  readonly getDraft: () => CompanyLegalFormDraft;
  readonly setDraft: (draft: CompanyLegalFormDraft) => void;
  readonly setOrigin: (draft: CompanyLegalFormDraft) => void;
  readonly baselineRef: { current: CompanyLegalFormSnapshot | null };
  readonly setBaseline: (baseline: CompanyLegalFormSnapshot | null) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: CompanyLegalFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: CompanyLegalFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [saveBusy, setSaveBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState<CompanyLegalFormWrite | null>(
    null,
  );
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<CompanyLegalFormWrite | null>(null);
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

  const mutation = useContractMutation(
    (input: CompanyLegalFormWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindCompanyLegalFormMutate(current)(input, options);
    },
  );

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (
      saveBusyRef.current ||
      apiClient === null ||
      current.loadKind !== "ready"
    ) {
      return;
    }
    saveBusyRef.current = true;
    setSaveBusy(true);
    try {
      await runCompanyLegalFormSave({
        getDraft: current.getDraft,
        getMode: () => current.mode,
        getBaseline: () => current.baselineRef.current,
        setDraft: current.setDraft,
        setBaseline: (baseline) => {
          current.baselineRef.current = baseline;
          current.setBaseline(baseline);
        },
        setOrigin: current.setOrigin,
        getLastWrite: () => lastWriteRef.current,
        setLastWrite: (write) => {
          lastWriteRef.current = write;
          setLastWrite(write);
        },
        getLastFailure: () => lastFailureRef.current,
        setLastFailure: (failure) => {
          lastFailureRef.current = failure;
        },
        setFieldErrors: current.setFieldErrors,
        submit: mutation.submit,
        retry: mutation.retry,
        resetMutation: mutation.reset,
        finish: async () => {
          await invalidateCompanyAfterWrite({
            queryClient,
            companyId: activeCompanyId,
          });
          await current.onSaved();
        },
      });
    } catch (error: unknown) {
      lastFailureRef.current = {
        kind: describeQueryFailure(error).kind,
        wire: describeWireError(error)?.code ?? null,
      };
    } finally {
      saveBusyRef.current = false;
      if (mountedRef.current) {
        setSaveBusy(false);
      }
    }
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
