import { useLocalSearchParams } from "expo-router";

import { ProductDetailView } from "./product-detail-view";
import { useProductDetail } from "./use-product-detail";

export function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useProductDetail(id);
  return <ProductDetailView {...model} />;
}
