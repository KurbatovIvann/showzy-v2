import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../api/api-provider";
import { useAuthSession } from "../../../auth/session-provider";
import { listMineQueryOptions } from "./list-mine";

export function useListMine() {
  const client = useApiClient();
  const auth = useAuthSession();
  return useQuery(
    listMineQueryOptions(client, auth.status === "authenticated"),
  );
}
