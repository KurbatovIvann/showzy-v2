import { createFileRoute } from "@tanstack/react-router";

import { SectionDetailRoutePage } from "../../../../../../features/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/customers/groups/new",
)({
  component: SectionDetailRoutePage,
});
