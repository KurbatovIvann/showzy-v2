import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspaceLayout } from "../../../../../features/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/customers")({
  staticData: {
    panel: {
      panelSection: "customers",
      pane: "list",
      listTo: "/$companySlug/customers",
    },
  },
  component: SectionWorkspaceLayout,
});
