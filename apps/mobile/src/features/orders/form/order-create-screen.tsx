import { OrderFormView } from "./order-form-view";
import { useOrderForm } from "./use-order-form";

export function OrderCreateScreen() {
  const model = useOrderForm();
  return <OrderFormView {...model} />;
}
