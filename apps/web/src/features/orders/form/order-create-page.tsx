import { OrderCreateView } from "./order-create-view";
import { useOrderCreate } from "./use-order-create";

export function OrderCreatePage({
  showBack,
  onBack,
  onCreated,
}: {
  readonly showBack: boolean;
  readonly onBack: () => void;
  readonly onCreated: (orderId: string) => void;
}) {
  const model = useOrderCreate({ onCreated });
  return <OrderCreateView model={model} showBack={showBack} onBack={onBack} />;
}
