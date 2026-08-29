/**
 * Company settings hub composer (SHO-226). Query stays in `api/`;
 * classification and identity/legal presenters are pure. View stays
 * presentational. No RHF and no writes.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { companiesCopy } from "../../../i18n/companies";
import { getCompanyQueryOptions } from "../api/company.queries";
import { companyLegalHref } from "../shared/company-hrefs";
import { canViewCompanySettings } from "../shared/company-permissions";
import {
  classifyCompanySettings,
  companyIdentityView,
  companyLegalRow,
  type CompanyIdentityView,
  type CompanyLegalRowView,
  type CompanySettingsState,
} from "./company-settings.presenter";

export type CompanySettingsModel = {
  readonly copy: ReturnType<typeof companiesCopy>;
  readonly state: CompanySettingsState;
  readonly identity: CompanyIdentityView | null;
  readonly legalRow: CompanyLegalRowView | null;
  readonly goBack: () => void;
  readonly retry: () => void;
  readonly openLegal: () => void;
};

export function useCompanySettings(): CompanySettingsModel {
  const locale = detectLocale();
  const copy = useMemo(() => companiesCopy(locale), [locale]);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canView = canViewCompanySettings(membership.role);
  const router = useRouter();

  const query = useQuery(
    getCompanyQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
      enabled: canView,
    }),
  );

  const failureKind = query.isError
    ? describeQueryFailure(query.error).kind
    : null;
  const state = classifyCompanySettings({
    canView,
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: query.status,
    failureKind,
  });

  const identity =
    query.data === undefined
      ? null
      : companyIdentityView({
          name: query.data.name,
          slug: query.data.slug,
          prefix: query.data.prefix,
          slugDisplayTemplate: copy.slugDisplay,
          prefixExplanationTemplate: copy.prefixExplanation,
        });
  const legalRow =
    query.data === undefined
      ? null
      : companyLegalRow({
          legal: query.data.legal,
          missingLabel: copy.legalMissing,
        });

  return {
    copy,
    state,
    identity,
    legalRow,
    goBack: () => {
      router.back();
    },
    retry: () => {
      void query.refetch();
    },
    openLegal: () => {
      router.push(companyLegalHref());
    },
  };
}
