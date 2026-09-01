import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspaceLayout } from "../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/documents")({
  staticData: {
    panel: {
      panelSection: "documents",
      pane: "list",
      listTo: "/$companySlug/documents",
    },
  },
  component: SectionWorkspaceLayout,
});
