import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { useAuthSession } from "../auth/session-provider";
import { userFromSessionResult } from "../auth/session-user";
import { BootScreen } from "../features/auth/boot-screen";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    const result = await context.authClient.getSession();
    const session = userFromSessionResult(result);
    if (session === null) {
      throw redirect({ to: "/sign-in" });
    }
    return { session };
  },
  component: AuthedLayout,
  pendingComponent: BootScreen,
});

function AuthedLayout() {
  const auth = useAuthSession();
  if (auth.status === "loading") {
    return <BootScreen />;
  }
  if (auth.status === "anonymous") {
    return <Navigate to="/sign-in" />;
  }
  return <Outlet />;
}
