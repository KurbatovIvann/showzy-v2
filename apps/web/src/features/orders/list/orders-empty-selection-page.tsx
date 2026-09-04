import { DetailStage } from "../../../components/ui/detail-stage";
import { PaneHeader } from "../../../components/ui/pane-header";
import { detectLocale } from "../../../i18n/locale";
import { panelChromeCopy } from "../../../i18n/panel/chrome";
import { useOrdersCopy } from "../shared/use-orders-copy";

export function OrdersEmptySelectionPage() {
  const copy = useOrdersCopy();
  const chromeCopy = panelChromeCopy(
    detectLocale(typeof navigator === "undefined" ? "uk" : navigator.language),
  );
  return (
    <DetailStage
      label={chromeCopy.detailLabel}
      className="flex h-full flex-col"
    >
      <PaneHeader
        title={copy.title}
        menuLabel={chromeCopy.menu}
        backLabel={chromeCopy.backToList}
        onOpenNav={() => undefined}
        showMenu={false}
        showBack={false}
      />
      <div className="px-6 py-16 text-center">
        <h2 className="text-[16px] font-normal text-muted">
          {copy.emptySelection}
        </h2>
      </div>
    </DetailStage>
  );
}
