import { useLocalSearchParams } from "expo-router";

import { CustomerFormView } from "./customer-form-view";
import { useCustomerForm } from "./use-customer-form";

export function CustomerCreateScreen() {
  const model = useCustomerForm({ mode: "create" });
  return <CustomerFormView {...model} />;
}

export function CustomerEditScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useCustomerForm({ mode: "edit", idParam: id });
  return <CustomerFormView {...model} />;
}
