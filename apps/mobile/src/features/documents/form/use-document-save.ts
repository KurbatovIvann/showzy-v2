/**
 * Document create save hook (SHO-238). Wraps `runDocumentFormSave` with
 * `useContractMutation` and list invalidation + handover callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { invalidateDocumentsAfterWrite } from "../api/document-writes";
import { bindDocumentFormMutate } from "../api/document-form-mutation";
import type {
  DocumentFormDraft,
  DocumentFormFieldErrors,
} from "./document-form-draft";
import type { DocumentFormLoadState } from "./document-form-load";
import type {
  CreateFromOrderResult,
  DocumentFormWrite,
} from "./document-form-plan";
import {
  NO_SAVE_FAILURE,
  runDocumentFormSave,
  type LastWriteFailure,
} from "./document-form-save";

export function useDocumentSave(args: {
  readonly loadKind: DocumentFormLoadState["kind"];
  readonly getDraft: () => DocumentFormDraft;
  readonly setOrigin: (draft: DocumentFormDraft) => void;
  readonly onSaved: (result: CreateFromOrderResult) => Promise<void>;
  readonly setFieldErrors: (errors: DocumentFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: DocumentFormWrite | null;
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
  const [lastWrite, setLastWrite] = useState<DocumentFormWrite | null>(null);
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<DocumentFormWrite | null>(null);
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

  const mutation = useContractMutation((input: DocumentFormWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindDocumentFormMutate(current)(input, options);
  });

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
      await runDocumentFormSave({
        getDraft: current.getDraft,
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
        finish: async (result) => {
          await invalidateDocumentsAfterWrite({
            queryClient,
            companyId: activeCompanyId,
          });
          await current.onSaved(result);
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
