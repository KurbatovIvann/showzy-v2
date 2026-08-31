import { useAuthSession } from "../../auth/session-provider";

export function BootScreen() {
  const auth = useAuthSession();
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-[15px] text-muted">{auth.copy.loading}</p>
    </main>
  );
}
