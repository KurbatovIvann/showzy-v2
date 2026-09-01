/**
 * One composition point for active-company side effects.
 * Tenant-cache isolation subscribes to `onActiveCompanyChange` — do not
 * wrap `setActiveCompany`. Last-slug persistence is written by the
 * company layout (URL is the source of truth); a cleared selector drops
 * the stored slug so the next session cannot inherit it.
 */
import type { QueryClient } from "@tanstack/react-query";

import type { CompanyPrefs } from "../prefs/company-prefs";
import type { ActiveCompanyListenerHost } from "./client";
import { bindActiveCompanyQueryIsolation } from "./query-client";

export function bindActiveCompanyRuntime(args: {
  readonly client: ActiveCompanyListenerHost;
  readonly queryClient: QueryClient;
  readonly prefs: Pick<CompanyPrefs, "setLastCompanySlug">;
  readonly onCompanyId?: (companyId: string | null) => void;
}): () => void {
  return bindActiveCompanyQueryIsolation(args.client, args.queryClient, {
    onCompanyId: (companyId) => {
      args.onCompanyId?.(companyId);
      if (companyId === null) {
        args.prefs.setLastCompanySlug(null);
      }
    },
  });
}
