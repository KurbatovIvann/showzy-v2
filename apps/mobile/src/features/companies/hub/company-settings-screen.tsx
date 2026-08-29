import { CompanySettingsView } from "./company-settings-view";
import { useCompanySettings } from "./use-company-settings";

export function CompanySettingsScreen() {
  const model = useCompanySettings();
  return <CompanySettingsView {...model} />;
}
