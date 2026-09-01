import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/customers/counterparties",
)({
  component: Outlet,
});
