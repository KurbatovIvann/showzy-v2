import { useListMine } from "../api/use-list-mine";
import { matchMembershipBySlug } from "../scope/match-membership";

export function CompanyHomeScreen({
  companySlug,
}: {
  readonly companySlug: string;
}) {
  const listMine = useListMine();
  const match = matchMembershipBySlug(
    listMine.data?.memberships ?? [],
    companySlug,
  );
  const name = match?.company.name ?? companySlug;
  return (
    <main className="px-4 py-6">
      <h1 className="text-lg font-semibold text-ink">{name}</h1>
    </main>
  );
}
