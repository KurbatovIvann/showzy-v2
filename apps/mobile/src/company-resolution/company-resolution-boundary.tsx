import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";

import { listMineQueryOptions } from "../api/company-membership-query";
import { useApiClient } from "../api/api-provider";
import { useActiveCompany } from "../api/query-provider";
import { useAuthSession } from "../auth/session-provider";
import {
  CompanyResolutionError,
  CompanyResolutionLoading,
  MultipleCompaniesStub,
} from "../components/screens/company-resolution/company-resolution-state";
import { companyResolutionCopy } from "../i18n/company-resolution";
import { detectLocale } from "../i18n/locale";
import { applyCompanyResolution } from "./apply-company-resolution";
import { ResolvedCompanyProvider } from "./resolved-company-provider";
import { membershipQueryState, resolveCompany } from "./resolve-company";

export function CompanyResolutionBoundary(props: {
  readonly children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiClient = useApiClient();
  const { activeCompanyId, setActiveCompany } = useActiveCompany();
  const { replace } = useRouter();
  const copy = useMemo(() => companyResolutionCopy(detectLocale()), []);
  const sessionUserId = auth.session?.userId ?? null;
  const query = useQuery(listMineQueryOptions(apiClient, sessionUserId));
  const resolution = useMemo(
    () =>
      resolveCompany(
        membershipQueryState({
          data: query.data,
          isError: query.isError,
          clientReady: apiClient !== null,
          sessionReady: sessionUserId !== null,
        }),
        activeCompanyId,
      ),
    [activeCompanyId, apiClient, query.data, query.isError, sessionUserId],
  );

  useEffect(() => {
    applyCompanyResolution({
      resolution,
      setActiveCompany,
      replace,
    });
  }, [replace, resolution, setActiveCompany]);

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
    return (
      <MultipleCompaniesStub
        copy={copy}
        onSignOut={() => {
          void auth.signOut().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <ResolvedCompanyProvider membership={resolution.membership}>
      {props.children}
    </ResolvedCompanyProvider>
  );
}
