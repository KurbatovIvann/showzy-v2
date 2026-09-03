/**
 * Cross-feature `companies.listMine` entry. Domain screens import this
 * `shared/` path — not `companies/api/` internals (layer rule).
 */
export { useListMine } from "../api/use-list-mine";
export type { CompanyMembership } from "../api/list-mine";
