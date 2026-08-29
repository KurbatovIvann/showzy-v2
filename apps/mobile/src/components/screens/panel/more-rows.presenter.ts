import type { CompanyRole } from "../../../features/companies/shared/company-permissions";
import { canViewCompanySettings } from "../../../features/companies/shared/company-permissions";
import { canViewDocuments } from "../../../features/documents/shared/document-permissions";
import { canViewPriceLists } from "../../../features/pricing/shared/price-list-permissions";

export type MoreRowState = {
  readonly documentsEnabled: boolean;
  readonly showPriceLists: boolean;
  readonly showCompanySettings: boolean;
};

/**
 * More-tab row affordances. Documents open for `documents:view`
 * (seeded for every staff role, including employee). Company settings
 * hide for roles without `settings:payments`.
 */
export function moreRowState(role: CompanyRole): MoreRowState {
  return {
    documentsEnabled: canViewDocuments(role),
    showPriceLists: canViewPriceLists(role),
    showCompanySettings: canViewCompanySettings(role),
  };
}
