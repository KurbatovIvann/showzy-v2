import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { OtpProvider } from "../auth/otp/provider";
import { useAuthSession } from "../auth/session-provider";
import { userFromSessionResult } from "../auth/session-user";
import { BootScreen } from "../features/auth/boot-screen";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    const result = await context.authClient.getSession();
    if (userFromSessionResult(result) !== null) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthLayout,
  pendingComponent: BootScreen,
});

function AuthLayout() {
  const auth = useAuthSession();
  if (auth.status === "authenticated") {
    return <Navigate to="/" />;
  }
  // Keep OtpProvider mounted across a session refetch so `/verify` does
  // not lose the in-flight OTP and bounce back to `/sign-in`.
  return (
    <OtpProvider>
      {auth.status === "loading" ? <BootScreen /> : <Outlet />}
    </OtpProvider>
  );
}
