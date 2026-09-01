import { useLayoutEffect, useMemo } from "react";

import { useActiveCompany } from "../../api/query-provider";
import { createBrowserCompanyPrefs } from "../../prefs/company-prefs";
import { matchMembershipBySlug } from "./resolve-company";
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
    setActiveCompany(match.company.id);
    createBrowserCompanyPrefs().setLastCompanySlug(match.company.slug);
  }, [match, setActiveCompany]);

  return {
    listMine,
    memberships,
    match,
    ready: match !== undefined && activeCompanyId === match.company.id,
  };
}
