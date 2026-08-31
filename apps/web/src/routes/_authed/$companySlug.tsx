import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/$companySlug")({
  component: CompanyLayoutPlaceholder,
});

/**
 * Placeholder company layout (SHO-309). The real layout resolves the slug
 * via `companies.listMine`, sets `x-company-id`, and guards unknown slugs
 * (ADR-0030) — that arrives with the company-scope web ticket. The slug is a
 * display selector, never an access grant (ADR-0013).
 */
function CompanyLayoutPlaceholder() {
  const { companySlug } = Route.useParams();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <p className="text-sm">Компанія: {companySlug}</p>
      <Outlet />
    </main>
  );
}
