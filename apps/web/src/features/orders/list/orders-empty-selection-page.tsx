import { DetailStage } from "../../../components/ui/detail-stage";
import { useOrdersCopy } from "../shared/use-orders-copy";

export function OrdersEmptySelectionPage() {
  const copy = useOrdersCopy();
  return (
    <DetailStage label={copy.emptySelection} className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-6 py-14 text-center">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">
          {copy.emptySelection}
        </h2>
      </div>
    </DetailStage>
  );
}
