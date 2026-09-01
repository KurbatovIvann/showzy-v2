import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/customers/groups",
)({
  staticData: {
    panel: {
      panelSection: "customer-groups",
      listTo: "/$companySlug/customers/groups",
    },
  },
  component: Outlet,
});
