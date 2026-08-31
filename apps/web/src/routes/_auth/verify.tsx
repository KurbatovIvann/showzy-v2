import { createFileRoute } from "@tanstack/react-router";

import { VerifyScreen } from "../../features/auth/verify-screen";

export const Route = createFileRoute("/_auth/verify")({
  component: VerifyScreen,
});
