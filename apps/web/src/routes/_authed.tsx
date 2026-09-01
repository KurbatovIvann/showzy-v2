import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { useAuthSession } from "../auth/session-provider";
import { userFromSessionResult } from "../auth/session-user";
import { BootScreen } from "../features/auth/boot-screen";
import { listMineQueryOptions } from "../features/companies/api/list-mine";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    const result = await context.authClient.getSession();
    const session = userFromSessionResult(result);
    if (session === null) {
      throw redirect({ to: "/sign-in" });
    }
    return { session };
  },
  loader: ({ context }) => {
    // Do not await: blocking load() would hide the existing listMine
    // retry UI and deadlock tests that gate the first `/rpc`.
    void context.queryClient
      .ensureQueryData(
        listMineQueryOptions(context.apiClient, context.session.userId),
      )
      .catch(() => {
        // Cached error; feature hooks render retry UI.
      });
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
