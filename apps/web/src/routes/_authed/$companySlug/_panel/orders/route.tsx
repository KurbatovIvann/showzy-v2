import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspaceLayout } from "../../../../../features/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/orders")({
  staticData: {
    panel: {
      panelSection: "orders",
      pane: "list",
      listTo: "/$companySlug/orders",
    },
  },
  component: SectionWorkspaceLayout,
});
