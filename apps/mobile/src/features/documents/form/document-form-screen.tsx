import { DocumentFormView } from "./document-form-view";
import { useDocumentForm } from "./use-document-form";

export function DocumentFormScreen() {
  const model = useDocumentForm();
  return <DocumentFormView {...model} />;
}
