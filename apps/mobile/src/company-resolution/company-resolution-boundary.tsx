import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";

import { listMineQueryOptions } from "../api/company-membership-query";
import { useApiClient } from "../api/api-provider";
import { useActiveCompany } from "../api/query-provider";
import { useAuthSession } from "../auth/session-provider";
import { companyResolutionCopy } from "../i18n/company-resolution";
import { detectLocale } from "../i18n/locale";
import { applyCompanyResolution } from "./apply-company-resolution";
import {
  CompanyResolutionError,
  CompanyResolutionLoading,
  MultipleCompaniesStub,
} from "./company-resolution-state";
import { ResolvedCompanyProvider } from "./resolved-company-provider";
import { resolveCompany } from "./resolve-company";

export function CompanyResolutionBoundary(props: {
  readonly children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiClient = useApiClient();
  const { activeCompanyId, setActiveCompany } = useActiveCompany();
  const queryClient = useQueryClient();
  const { replace } = useRouter();
  const copy = useMemo(() => companyResolutionCopy(detectLocale()), []);
  const sessionUserId = auth.session?.userId ?? "";
  const query = useQuery(listMineQueryOptions(apiClient, sessionUserId));
  const resolution = useMemo(
    () =>
      resolveCompany(
        query.isPending
          ? { status: "loading" }
          : query.isError
            ? { status: "error" }
            : { status: "success", data: query.data },
        activeCompanyId,
      ),
    [activeCompanyId, query.data, query.isError, query.isPending],
  );

  useEffect(() => {
    applyCompanyResolution({
      resolution,
      sessionUserId,
      queryClient,
      setActiveCompany,
      replace,
    });
  }, [queryClient, replace, resolution, sessionUserId, setActiveCompany]);

  if (
    resolution.kind === "loading" ||
    resolution.kind === "onboarding" ||
    resolution.kind === "select"
  ) {
    return <CompanyResolutionLoading label={copy.loading} />;
  }
  if (resolution.kind === "error") {
    return (
      <CompanyResolutionError
        copy={copy}
        retrying={query.isFetching}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (resolution.kind === "multiple-unresolved") {
    return <MultipleCompaniesStub copy={copy} />;
  }

  return (
    <ResolvedCompanyProvider membership={resolution.membership}>
      {props.children}
    </ResolvedCompanyProvider>
  );
}
