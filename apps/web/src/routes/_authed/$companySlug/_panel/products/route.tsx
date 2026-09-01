import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspaceLayout } from "../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/products")({
  staticData: {
    panel: {
      panelSection: "products",
      pane: "list",
      listTo: "/$companySlug/products",
    },
  },
  component: SectionWorkspaceLayout,
});
