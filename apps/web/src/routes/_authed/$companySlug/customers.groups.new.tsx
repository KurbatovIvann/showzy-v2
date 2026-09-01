import { createFileRoute } from "@tanstack/react-router";

import { SectionWorkspacePage } from "../../../features/panel/section-workspace";

export const Route = createFileRoute("/_authed/$companySlug/customers/groups/new")({
  component: SectionWorkspacePage,
});
