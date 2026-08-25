import { Slot } from "expo-router";

import { CompanyResolutionBoundary } from "../../../company-resolution/company-resolution-boundary";

/**
 * Product stack sits beside the tab shell on the (app) Stack, so it
 * does not inherit the tabs' company-resolution provider. Wrap these
 * routes the same way so `useResolvedCompany` (permission affordances)
 * is defined on detail / stubs.
 */
export default function ProductsLayout() {
  return (
    <CompanyResolutionBoundary>
      <Slot />
    </CompanyResolutionBoundary>
  );
}
