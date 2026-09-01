import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../api/api-provider";
import { listMineQueryOptions } from "../../api/company-membership-query";
import { useAuthSession } from "../../auth/session-provider";

export function useListMine() {
  const client = useApiClient();
  const auth = useAuthSession();
  return useQuery(
    listMineQueryOptions(client, auth.status === "authenticated"),
  );
}
