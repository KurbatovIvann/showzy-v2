/**
 * `docGeneration.listLayouts` for the create form (SHO-366). Applies
 * the type's `isDefault` when the current key is missing or belongs to
 * the previous type. Query is `enabled` only when the create screen is
 * ready (`documents:create`).
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { listDocumentLayoutsQueryOptions } from "../api/document-layouts-query";
import type { DocumentFormDraft } from "./document-form-draft";
import {
  nextLayoutKeyOnCatalog,
  type DocumentFormLayoutsStatus,
  type DocumentLayoutOption,
} from "./document-form-layouts";
import type { DocumentFormType } from "./document-form.schema";

export function useDocumentFormLayouts(args: {
  readonly enabled: boolean;
  readonly type: DocumentFormType;
  readonly layoutKey: string;
  readonly setValue: UseFormSetValue<DocumentFormDraft>;
}): {
  readonly layouts: readonly DocumentLayoutOption[];
  readonly status: DocumentFormLayoutsStatus;
  readonly retry: () => void;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const { setValue, layoutKey, enabled, type } = args;
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;

  const query = useQuery(
    listDocumentLayoutsQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      type,
      getActiveCompany,
      enabled,
    }),
  );

  const layouts = query.data?.layouts ?? [];

  useEffect(() => {
    if (query.data === undefined) {
      return;
    }
    const nextKey = nextLayoutKeyOnCatalog(query.data.layouts, layoutKey);
    if (nextKey.length > 0 && nextKey !== layoutKey) {
      setValue("layoutKey", nextKey, { shouldDirty: layoutKey.length > 0 });
    }
  }, [query.data, layoutKey, setValue]);

  const status: DocumentFormLayoutsStatus = !enabled
    ? "loading"
    : query.isError
      ? "error"
      : query.data !== undefined
        ? "ready"
        : "loading";

  return {
    layouts,
    status,
    retry: () => {
      void query.refetch();
    },
  };
}
