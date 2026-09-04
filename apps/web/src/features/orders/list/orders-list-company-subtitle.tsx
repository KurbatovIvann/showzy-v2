import { useActiveCompany } from "../../../api/query-provider";
import { useListMine } from "../../companies/shared/list-mine";

/** Canvas list header subtitle is the company trade name. */
export function OrdersListCompanySubtitle() {
  const listMine = useListMine();
  const { activeCompanyId } = useActiveCompany();
  const membership = (listMine.data?.memberships ?? []).find(
    (item) => item.company.id === activeCompanyId,
  );
  if (membership === undefined) {
    return null;
  }
  return membership.company.name;
}
