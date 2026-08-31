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
  if (auth.status === "loading") {
    return <BootScreen />;
  }
  if (auth.status === "authenticated") {
    return <Navigate to="/" />;
  }
  return (
    <OtpProvider>
      <Outlet />
    </OtpProvider>
  );
}
