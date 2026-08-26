import { useLocalSearchParams } from "expo-router";

import { ProductFormView } from "./product-form-view";
import { useProductForm } from "./use-product-form";

export function ProductCreateScreen() {
  const model = useProductForm({ mode: "create" });
  return <ProductFormView {...model} />;
}

export function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useProductForm({ mode: "edit", idParam: id });
  return <ProductFormView {...model} />;
}
