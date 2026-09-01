import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspaceLayout } from "../../../../../features/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/pricing")({
  staticData: {
    panel: {
      panelSection: "pricing",
      pane: "list",
      listTo: "/$companySlug/pricing",
    },
  },
  component: SectionWorkspaceLayout,
});
