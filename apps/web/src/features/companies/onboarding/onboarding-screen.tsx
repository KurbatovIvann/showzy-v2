import { Navigate, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import type { CompanyMembership } from "../api/list-mine";
import { useListMine } from "../api/use-list-mine";
import {
  CompanyScopeError,
  CompanyScopeLoading,
} from "../scope/company-scope-status";
import { useCompanyScopeCopy } from "../scope/use-company-scope-copy";
import { OnboardingCompanyStep } from "./onboarding-company-step";
import { OnboardingLegalStep } from "./onboarding-legal-step";

/**
 * Full-shell takeover (SHO-324). Empty `listMine` stays here for create.
 * Memberships already present bounce to `/` unless this visit just created
 * a company and is still on the optional legal step.
 *
 * `createdRef` is written synchronously so a listMine cache seed cannot
 * bounce us to `/` before React flushes `created` state.
 */
export function OnboardingScreen() {
  const copy = useCompanyScopeCopy();
  const listMine = useListMine();
  const navigate = useNavigate();
  const createdRef = useRef<CompanyMembership | null>(null);
  const [created, setCreated] = useState<CompanyMembership | null>(null);
  const activeCreated = created ?? createdRef.current;

  if (listMine.isPending && activeCreated === null) {
    return <CompanyScopeLoading label={copy.loading} />;
  }
  if (listMine.isError && activeCreated === null) {
    return (
      <CompanyScopeError
        copy={copy}
        onRetry={() => {
          void listMine.refetch();
        }}
      />
    );
  }

  const memberships = listMine.data?.memberships ?? [];
  if (activeCreated === null && memberships.length > 0) {
    return <Navigate replace to="/" />;
  }

  function goToCompany(membership: CompanyMembership): void {
    void navigate({
      to: "/$companySlug",
      params: { companySlug: membership.company.slug },
      replace: true,
    });
  }

  if (activeCreated !== null) {
    return (
      <OnboardingLegalStep
        onFinished={() => {
          goToCompany(activeCreated);
        }}
      />
    );
  }

  return (
    <OnboardingCompanyStep
      onCreated={(membership) => {
        createdRef.current = membership;
        setCreated(membership);
      }}
    />
  );
}
