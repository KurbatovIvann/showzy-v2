import { useLayoutEffect, useMemo } from "react";

import { useActiveCompany } from "../../../api/query-provider";
import { createBrowserCompanyPrefs } from "../../../prefs/companies/company-prefs";
import { matchMembershipBySlug } from "../shared/resolve-company";
import { useListMine } from "./use-list-mine";

export function useCompanyScope(companySlug: string) {
  const listMine = useListMine();
  const { activeCompanyId, setActiveCompany } = useActiveCompany();
  const memberships = listMine.data?.memberships ?? [];
  const match = useMemo(
    () => matchMembershipBySlug(memberships, companySlug),
    [memberships, companySlug],
  );

  useLayoutEffect(() => {
    if (match === undefined) {
      return;
    }
    if (activeCompanyId !== match.company.id) {
      setActiveCompany(match.company.id);
    }
    createBrowserCompanyPrefs().setLastCompanySlug(match.company.slug);
  }, [activeCompanyId, match, setActiveCompany]);

  return {
    listMine,
    memberships,
    match,
    ready: match !== undefined && activeCompanyId === match.company.id,
  };
}
