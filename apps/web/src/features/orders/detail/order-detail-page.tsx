import { OrderDetailView } from "./order-detail-view";
import { useOrderDetail } from "./use-order-detail";

export function OrderDetailPage({
  orderId,
  showBack,
  onBack,
}: {
  readonly orderId: string;
  readonly showBack: boolean;
  readonly onBack: () => void;
}) {
  const model = useOrderDetail(orderId);
  return (
    <OrderDetailView
      copy={model.copy}
      state={model.state}
      order={model.order}
      headerTitle={model.headerTitle}
      showBack={showBack}
      onBack={onBack}
      showConfirm={model.showConfirm}
      showStart={model.showStart}
      showComplete={model.showComplete}
      showActions={model.showActions}
      cancelEnabled={model.cancelEnabled}
      confirmPending={model.confirmPending}
      startPending={model.startPending}
      completePending={model.completePending}
      cancelPending={model.cancelPending}
      statusBanner={model.statusBanner}
      onRetry={model.retry}
      onConfirm={model.confirm}
      onStart={model.start}
      onComplete={model.complete}
      onCancel={model.cancel}
    />
  );
}
