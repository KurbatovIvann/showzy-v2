import { createFileRoute } from "@tanstack/react-router";

import { SignInScreen } from "../../features/auth/sign-in-screen";

export const Route = createFileRoute("/_auth/sign-in")({
  component: SignInScreen,
});
