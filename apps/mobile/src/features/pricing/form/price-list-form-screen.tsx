import { useLocalSearchParams } from "expo-router";

import { PriceListFormView } from "./price-list-form-view";
import { usePriceListForm } from "./use-price-list-form";

export function PriceListCreateScreen() {
  const model = usePriceListForm({ mode: "create" });
  return <PriceListFormView {...model} />;
}

export function PriceListEditScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = usePriceListForm({ mode: "edit", idParam: id });
  return <PriceListFormView {...model} />;
}
