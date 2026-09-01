import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspaceLayout } from "../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/_panel/invites")({
  staticData: {
    panel: {
      panelSection: "invites",
      pane: "list",
      listTo: "/$companySlug/invites",
    },
  },
  component: SectionWorkspaceLayout,
});
