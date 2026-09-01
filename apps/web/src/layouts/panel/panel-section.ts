/**
 * Panel section ids and typed list destinations. Section / pane / back
 * come from route static data + matches, never pathname prefixes.
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

/** Sidebar / phone primary tabs collapse customer sub-tabs into Customers. */
export function sidebarNavSection(section: PanelSectionId): PanelSectionId {
  if (section === "customer-groups" || section === "counterparties") {
    return "customers";
  }
  return section;
}
