/**
 * One composition point for active-company side effects (SHO-297).
 * Persistence and tenant-cache isolation both subscribe to the client's
 * `onActiveCompanyChange` listener API — they must not wrap
 * `setActiveCompany`.
 */
import type { QueryClient } from "@tanstack/react-query";

import {
  bindCompanySelectorPersistence,
  type DevicePrefs,
} from "../prefs/device-prefs";
import type { ActiveCompanyListenerHost } from "./client";
import { bindActiveCompanyQueryIsolation } from "./query-client";

export function bindActiveCompanyRuntime(args: {
  readonly client: ActiveCompanyListenerHost;
  readonly prefs: Pick<DevicePrefs, "setLastCompanyId">;
  readonly queryClient: QueryClient;
  readonly onCompanyId?: (companyId: string | null) => void;
}): () => void {
  const unbindPersistence = bindCompanySelectorPersistence(
    args.client,
    args.prefs,
  );
  const unbindIsolation = bindActiveCompanyQueryIsolation(
    args.client,
    args.queryClient,
    { onCompanyId: args.onCompanyId },
  );
  return () => {
    unbindPersistence();
    unbindIsolation();
  };
}
