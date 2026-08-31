import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";

export const Route = createFileRoute("/_authed/")({
  component: RootPlaceholder,
});

/**
 * Placeholder root (SHO-309). The real route redirects to the last
 * company or the company picker once company scope lands (SHO-313).
 */
function RootPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <Store aria-hidden className="size-8" />
      <h1 className="text-lg font-semibold">Showzy</h1>
      <p className="text-sm">Панель у розробці</p>
    </main>
  );
}
