import { createFileRoute } from "@tanstack/react-router";

import { PANEL_DETAIL } from "../../../../../../features/panel/panel-route-state";
import { SectionDetailRoutePage } from "../../../../../../features/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/customers/groups/$groupId",
)({
  staticData: PANEL_DETAIL,
  component: SectionDetailRoutePage,
});
