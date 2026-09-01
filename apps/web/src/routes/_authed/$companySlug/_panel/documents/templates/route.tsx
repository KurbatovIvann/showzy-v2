import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/documents/templates",
)({
  staticData: {
    panel: {
      panelSection: "documents",
      listTo: "/$companySlug/documents/templates",
    },
  },
  component: Outlet,
});
