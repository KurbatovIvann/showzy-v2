import { ProductsListView } from "./products-list-view";
import { useProductsList } from "./use-products-list";

export function ProductsListScreen() {
  const model = useProductsList();
  return <ProductsListView {...model} />;
}
