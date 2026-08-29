import { useLocalSearchParams } from "expo-router";

import { OrderDetailView } from "./order-detail-view";
import { useOrderDetail } from "./use-order-detail";

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useOrderDetail(id);
  return <OrderDetailView {...model} />;
}
