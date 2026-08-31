import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import type { AppRouterContext } from "../router";
import { BootScreen } from "../features/auth/boot-screen";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootLayout,
  pendingComponent: BootScreen,
});

function RootLayout() {
  return <Outlet />;
}
