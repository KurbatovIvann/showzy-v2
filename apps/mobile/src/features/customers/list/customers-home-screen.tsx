import { CustomersHomeView } from "./customers-home-view";
import { useCustomersHome } from "./use-customers-home";

export function CustomersHomeScreen() {
  const model = useCustomersHome();
  return <CustomersHomeView {...model} />;
}
