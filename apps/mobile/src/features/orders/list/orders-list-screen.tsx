import { OrdersListView } from "./orders-list-view";
import { useOrdersList } from "./use-orders-list";

export function OrdersListScreen() {
  const model = useOrdersList();
  return <OrdersListView {...model} />;
}
