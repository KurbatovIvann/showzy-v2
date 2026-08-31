import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/verify")({
  component: VerifyPlaceholder,
});

/** Placeholder (SHO-309). The OTP code screen lands with the web auth ticket. */
function VerifyPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm">Підтвердження коду — у розробці</p>
    </main>
  );
}
