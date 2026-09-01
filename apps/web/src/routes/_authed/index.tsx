import { createFileRoute } from "@tanstack/react-router";

import { CompanyRootScreen } from "../../features/companies/picker/company-root-screen";

export const Route = createFileRoute("/_authed/")({
  component: CompanyRootScreen,
});
