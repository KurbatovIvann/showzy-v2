import { useLocalSearchParams } from "expo-router";

import { ProductPhotosView } from "./product-photos-view";
import { useProductPhotos } from "./use-product-photos";

export function ProductPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useProductPhotos(id);
  return <ProductPhotosView {...model} />;
}
