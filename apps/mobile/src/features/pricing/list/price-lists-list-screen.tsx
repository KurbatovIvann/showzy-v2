import { PriceListsListView } from "./price-lists-list-view";
import { usePriceListsList } from "./use-price-lists-list";

export function PriceListsListScreen() {
  const model = usePriceListsList();
  return <PriceListsListView {...model} />;
}
