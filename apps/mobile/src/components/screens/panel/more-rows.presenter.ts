import type { CompanyRole } from "../../../features/companies/shared/company-permissions";
import { canViewCompanySettings } from "../../../features/companies/shared/company-permissions";
import { canViewPriceLists } from "../../../features/pricing/shared/price-list-permissions";

export type MoreRowState = {
  readonly documentsEnabled: false;
  readonly showPriceLists: boolean;
  readonly showCompanySettings: boolean;
};

/**
 * More-tab row affordances. Documents stay disabled until the documents
 * feature. Company settings hide for roles without `settings:payments`.
 */
export function moreRowState(role: CompanyRole): MoreRowState {
  return {
    documentsEnabled: false,
    showPriceLists: canViewPriceLists(role),
    showCompanySettings: canViewCompanySettings(role),
  };
}
