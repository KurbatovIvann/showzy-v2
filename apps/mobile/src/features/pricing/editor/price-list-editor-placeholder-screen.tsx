import { useLocalSearchParams } from "expo-router";

import { priceListIdFromParam } from "../shared/price-list-id";
import { PriceListEditorPlaceholderView } from "./price-list-editor-placeholder-view";

export function PriceListCreatePlaceholderScreen() {
  return <PriceListEditorPlaceholderView mode="create" />;
}

export function PriceListEditPlaceholderScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const priceListId = priceListIdFromParam(id);
  return (
    <PriceListEditorPlaceholderView
      mode="edit"
      missing={priceListId === null}
    />
  );
}
