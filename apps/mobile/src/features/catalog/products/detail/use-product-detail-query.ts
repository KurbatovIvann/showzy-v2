/**
 * `catalog.getProduct` only (SHO-160). Photos hydrate from `imageFileIds`
 * on this result — do not start a second getProduct here.
 */
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../../api/api-provider";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { getProductQueryOptions } from "../api/product-detail-query";
import {
  classifyProductDetail,
  productIdFromParam,
  toProductDetailView,
  type ProductDetailState,
  type ProductDetailViewModel,
} from "./product-detail-model";

export function useProductDetailQuery(idParam: string | string[] | undefined): {
  readonly productId: string | null;
  readonly state: ProductDetailState;
  readonly product: ProductDetailViewModel | null;
  readonly imageFileIds: readonly string[] | undefined;
  readonly retry: () => void;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const productId = productIdFromParam(idParam);
  const query = useQuery(
    getProductQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      productId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const failureKind = query.isError
    ? describeQueryFailure(query.error).kind
    : null;

  return {
    productId,
    state: classifyProductDetail({
      productId,
      clientReady: apiClient !== null && activeCompanyId !== null,
      status: query.status,
      failureKind,
    }),
    product: query.data === undefined ? null : toProductDetailView(query.data),
    imageFileIds: query.data?.imageFileIds,
    retry: () => {
      void query.refetch();
    },
  };
}
