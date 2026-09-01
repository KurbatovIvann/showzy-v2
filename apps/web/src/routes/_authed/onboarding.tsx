import { createFileRoute } from "@tanstack/react-router";

import { OnboardingScreen } from "../../features/companies/onboarding/onboarding-screen";

export const Route = createFileRoute("/_authed/onboarding")({
  component: OnboardingScreen,
});
