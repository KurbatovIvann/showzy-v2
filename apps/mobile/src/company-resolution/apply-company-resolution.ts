import type { CompanyResolution } from "./resolve-company";

export function applyCompanyResolution(args: {
  readonly resolution: CompanyResolution;
  readonly setActiveCompany: (companyId: string | null) => void;
  readonly replace: (href: "/onboarding/company") => void;
}): void {
  const resolution = args.resolution;
  if (resolution.kind === "onboarding") {
    if (resolution.clearSelector) {
      args.setActiveCompany(null);
    }
    args.replace("/onboarding/company");
    return;
  }
  if (resolution.kind === "select") {
    args.setActiveCompany(resolution.membership.company.id);
    return;
  }
  if (resolution.kind === "multiple-unresolved" && resolution.clearSelector) {
    args.setActiveCompany(null);
  }
}
