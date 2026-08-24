import { createContext, useContext, type ReactNode } from "react";

import type { CompanyMembership } from "../api/company-membership-query";

const ResolvedCompanyContext = createContext<CompanyMembership | null>(null);

export function ResolvedCompanyProvider(props: {
  readonly membership: CompanyMembership;
  readonly children: ReactNode;
}) {
  return (
    <ResolvedCompanyContext.Provider value={props.membership}>
      {props.children}
    </ResolvedCompanyContext.Provider>
  );
}

export function useResolvedCompany(): CompanyMembership {
  const membership = useContext(ResolvedCompanyContext);
  if (membership === null) {
    throw new Error(
      "useResolvedCompany must be used within ResolvedCompanyProvider",
    );
  }
  return membership;
}
