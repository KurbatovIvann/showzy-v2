/**
 * Panel section ids and URL mapping for the T1 chrome lock + architecture
 * route tree (`docs/design/web-panel-architecture.md` Routing).
 */
export type PanelSectionId =
  | "orders"
  | "documents"
  | "products"
  | "customers"
  | "customer-groups"
  | "counterparties"
  | "invites"
  | "pricing"
  | "company";

export type CompanySlugPath =
  | "/$companySlug"
  | "/$companySlug/orders"
  | "/$companySlug/documents"
  | "/$companySlug/documents/templates"
  | "/$companySlug/products"
  | "/$companySlug/customers"
  | "/$companySlug/customers/groups"
  | "/$companySlug/customers/counterparties"
  | "/$companySlug/invites"
  | "/$companySlug/pricing"
  | "/$companySlug/company"
  | "/$companySlug/company/legal"
  | "/$companySlug/company/team";

export const SECTION_LIST_PATH: Record<PanelSectionId, CompanySlugPath> = {
  orders: "/$companySlug/orders",
  documents: "/$companySlug/documents",
  products: "/$companySlug/products",
  customers: "/$companySlug/customers",
  "customer-groups": "/$companySlug/customers/groups",
  counterparties: "/$companySlug/customers/counterparties",
  invites: "/$companySlug/invites",
  pricing: "/$companySlug/pricing",
  company: "/$companySlug/company",
};

function restAfterSlug(pathname: string, companySlug: string): string {
  const prefix = `/${companySlug}`;
  if (pathname === prefix || pathname === `${prefix}/`) {
    return "";
  }
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length);
  }
  return pathname;
}

export function panelSectionFromPathname(
  pathname: string,
  companySlug: string,
): PanelSectionId {
  const rest = restAfterSlug(pathname, companySlug);
  if (rest.startsWith("/documents")) {
    return "documents";
  }
  if (rest.startsWith("/products")) {
    return "products";
  }
  if (rest.startsWith("/customers/groups")) {
    return "customer-groups";
  }
  if (rest.startsWith("/customers/counterparties")) {
    return "counterparties";
  }
  if (rest.startsWith("/customers")) {
    return "customers";
  }
  if (rest.startsWith("/invites")) {
    return "invites";
  }
  if (rest.startsWith("/pricing")) {
    return "pricing";
  }
  if (rest.startsWith("/company")) {
    return "company";
  }
  return "orders";
}

export function isSectionDetailPath(
  pathname: string,
  companySlug: string,
): boolean {
  const rest = restAfterSlug(pathname, companySlug);
  if (rest === "" || rest === "/") {
    return false;
  }
  if (rest === "/documents/templates" || rest === "/documents/templates/") {
    return false;
  }
  const section = panelSectionFromPathname(pathname, companySlug);
  const listPath = SECTION_LIST_PATH[section].replace(
    "/$companySlug",
    `/${companySlug}`,
  );
  const normalizedList = listPath.endsWith("/")
    ? listPath.slice(0, -1)
    : listPath;
  const normalizedFull = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  return normalizedFull !== normalizedList;
}

export function isFullShellPath(
  pathname: string,
  companySlug: string,
): boolean {
  const rest = restAfterSlug(pathname, companySlug);
  return /^\/documents\/templates\/[^/]+\/edit\/?$/.test(rest);
}

export function isDocumentsTemplatesPath(
  pathname: string,
  companySlug: string,
): boolean {
  const rest = restAfterSlug(pathname, companySlug);
  return rest.startsWith("/documents/templates");
}

export function listPathForPathname(
  pathname: string,
  companySlug: string,
): CompanySlugPath {
  if (isDocumentsTemplatesPath(pathname, companySlug)) {
    return "/$companySlug/documents/templates";
  }
  if (restAfterSlug(pathname, companySlug).startsWith("/company/legal")) {
    return "/$companySlug/company";
  }
  if (restAfterSlug(pathname, companySlug).startsWith("/company/team")) {
    return "/$companySlug/company";
  }
  return SECTION_LIST_PATH[panelSectionFromPathname(pathname, companySlug)];
}
