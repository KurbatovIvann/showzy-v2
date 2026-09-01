import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../api/api-provider";
import { useAuthSession } from "../../../auth/session-provider";
import { listMineQueryOptions } from "./list-mine";

export function useListMine() {
  const client = useApiClient();
  const auth = useAuthSession();
  const sessionUserId =
    auth.status === "authenticated" && auth.session !== null
      ? auth.session.userId
      : null;
  return useQuery(listMineQueryOptions(client, sessionUserId));
}
