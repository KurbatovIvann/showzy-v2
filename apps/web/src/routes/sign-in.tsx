import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in")({
  component: SignInPlaceholder,
});

/** Placeholder (SHO-309). The OTP entry screen lands with the web auth ticket. */
function SignInPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm">Вхід — у розробці</p>
    </main>
  );
}
