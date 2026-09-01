/**
 * Document create save hook (SHO-238 / SHO-306). Single
 * `documents.createFromOrder` write — form-kit `useFormSave` /
 * `runFormSave` fits.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { MutationCallOptions } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave } from "../../../components/form-kit";
import { bindDocumentFormMutate } from "../api/document-form-mutation";
import { invalidateDocumentsAfterWrite } from "../api/document-writes";
import type {
  DocumentFormDraft,
  DocumentFormFieldErrors,
} from "./document-form-draft";
import type { DocumentFormLoadState } from "./document-form-load";
import {
  parseThenPlanDocumentFormSave,
  type CreateFromOrderResult,
  type DocumentFormWrite,
} from "./document-form-plan";

export { runDocumentFormSave } from "./document-form-save";
export type {
  LastWriteFailure,
  DocumentFormSavePorts,
} from "./document-form-save";

function bindDocumentSave(
  client: ContractClient,
): (
  input: DocumentFormWrite,
  options: MutationCallOptions,
) => Promise<CreateFromOrderResult> {
  return bindDocumentFormMutate(client);
}

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
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useFormSave<
    DocumentFormDraft,
    DocumentFormWrite,
    CreateFromOrderResult,
    DocumentFormFieldErrors
  >({
    bindMutate: bindDocumentSave,
    invalidate: () =>
      invalidateDocumentsAfterWrite({
        queryClient,
        companyId: activeCompanyId,
      }),
    ready: args.loadKind === "ready",
    getDraft: args.getDraft,
    setOrigin: args.setOrigin,
    setFieldErrors: args.setFieldErrors,
    plan: ({ lastWrite, lastFailure }) =>
      parseThenPlanDocumentFormSave({
        draft: args.getDraft(),
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      }),
    onSaved: async (result) => {
      if (result === null) {
        return;
      }
      await args.onSaved(result);
    },
  });
}
