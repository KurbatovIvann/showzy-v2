/**
 * Price-list editor queries + load classification (SHO-304). Composer
 * owns hydrate/RHF; this hook owns the three reads.
 */
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { listAllCatalogProductsQueryOptions } from "../api/catalog-products-query";
import { getPriceListQueryOptions } from "../api/price-list-detail-query";
import { listAllPriceListEntriesQueryOptions } from "../api/price-list-entries-query";
import type { PriceListFormMode } from "./price-list-form-draft";
import { storedEntryMap } from "./price-list-form-draft";
import {
  classifyPriceListFormLoad,
  combinePriceListFormQueries,
} from "./price-list-form-load";
import {
  catalogProductsForForm,
  storedEntriesForForm,
} from "./price-list-form-rows";

export function usePriceListFormQueries(args: {
  readonly mode: PriceListFormMode;
  readonly canManage: boolean;
  readonly routePriceListId: string | null;
}) {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const clientReady = apiClient !== null && activeCompanyId !== null;
  const editEnabled =
    args.mode === "edit" &&
    args.canManage &&
    clientReady &&
    args.routePriceListId !== null;
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;

  const listQuery = useQuery(
    getPriceListQueryOptions({
      client: editEnabled ? apiClient : null,
      companyId: activeCompanyId,
      priceListId: args.routePriceListId,
      getActiveCompany,
    }),
  );
  const entriesQuery = useQuery(
    listAllPriceListEntriesQueryOptions({
      client: editEnabled ? apiClient : null,
      companyId: activeCompanyId,
      priceListId: args.routePriceListId,
      getActiveCompany,
    }),
  );
  const catalogQuery = useQuery(
    listAllCatalogProductsQueryOptions({
      client: editEnabled ? apiClient : null,
      companyId: activeCompanyId,
      enabled: editEnabled,
      getActiveCompany,
    }),
  );

  const catalogProducts = useMemo(
    () => catalogProductsForForm(catalogQuery.data ?? []),
    [catalogQuery.data],
  );
  const stored = useMemo(
    () => storedEntryMap(storedEntriesForForm(entriesQuery.data ?? [])),
    [entriesQuery.data],
  );
  const storedRef = useRef(stored);
  storedRef.current = stored;

  const combined = combinePriceListFormQueries([
    {
      status: listQuery.status,
      failureKind: listQuery.isError
        ? describeQueryFailure(listQuery.error).kind
        : null,
    },
    {
      status: entriesQuery.status,
      failureKind: entriesQuery.isError
        ? describeQueryFailure(entriesQuery.error).kind
        : null,
    },
    {
      status: catalogQuery.status,
      failureKind: catalogQuery.isError
        ? describeQueryFailure(catalogQuery.error).kind
        : null,
    },
  ]);
  const loadState = classifyPriceListFormLoad({
    mode: args.mode,
    canManage: args.canManage,
    priceListId: args.routePriceListId,
    clientReady,
    status: args.mode === "create" ? "success" : combined.status,
    failureKind: args.mode === "create" ? null : combined.failureKind,
  });

  const retry = useCallback(() => {
    void listQuery.refetch();
    void entriesQuery.refetch();
    void catalogQuery.refetch();
  }, [listQuery.refetch, entriesQuery.refetch, catalogQuery.refetch]);

  return {
    apiClient,
    activeCompanyId,
    clientReady,
    catalogProducts,
    storedRef,
    loadState,
    listData: listQuery.data,
    entriesData: entriesQuery.data,
    catalogData: catalogQuery.data,
    retry,
  };
}
