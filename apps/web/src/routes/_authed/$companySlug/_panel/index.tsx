import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspacePage } from "../../../../layouts/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/")({
  staticData: {
    panel: {
      panelSection: "orders",
      pane: "list",
      listTo: "/$companySlug/orders",
    },
  },
  component: SectionWorkspacePage,
});
