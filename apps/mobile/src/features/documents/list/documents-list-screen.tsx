import { useLocalSearchParams } from "expo-router";

import { orderIdFromParam } from "../shared/document-id";
import { DocumentsListView } from "./documents-list-view";
import { useDocumentsList } from "./use-documents-list";

export function DocumentsListScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = orderIdFromParam(params.orderId);
  const model = useDocumentsList({ orderId });
  return <DocumentsListView {...model} />;
}
