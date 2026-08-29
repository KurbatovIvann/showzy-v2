import { CompanyLegalFormView } from "./company-legal-form-view";
import { useCompanyLegalForm } from "./use-company-legal-form";

export function CompanyLegalFormScreen() {
  const model = useCompanyLegalForm();
  return <CompanyLegalFormView {...model} />;
}
