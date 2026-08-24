import { CreateCompanyView } from "./create-company-view";
import { useCreateCompany } from "./use-create-company";

export function CreateCompanyScreen() {
  const model = useCreateCompany();
  return <CreateCompanyView {...model} />;
}
