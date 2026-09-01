import { createFileRoute } from "@tanstack/react-router";

import { SectionDetailRoutePage } from "../../../../../../layouts/panel/section-workspace";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/customers/counterparties/",
)({
  component: SectionDetailRoutePage,
});
