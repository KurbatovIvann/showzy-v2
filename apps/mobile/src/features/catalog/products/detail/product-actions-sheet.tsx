import {
  ArchiveIcon,
  CameraIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";

import type { ProductsDetailCopy } from "../../../../i18n/products";
import { Sheet } from "../../../../components/ui";
import { ProductSheetAction } from "../shared/product-sheet-action";

/**
 * Canvas «Дії з товаром»: Редагувати, Фото (this screen), Архівувати|Відновити.
 */
export function ProductActionsSheet(props: {
  readonly visible: boolean;
  readonly archived: boolean;
  readonly copy: ProductsDetailCopy;
  readonly photosLabel: string;
  readonly onClose: () => void;
  readonly onHidden: () => void;
  readonly onEdit: () => void;
  readonly onPhotos: () => void;
  readonly onStatus: () => void;
}) {
  const { theme } = useUnistyles();
  const { copy } = props;
  const ink = theme.colors.foreground;
  const danger = theme.colors.destructive;
  const icon = theme.iconSize.sm;
  return (
    <Sheet
      visible={props.visible}
      title={copy.productActionsTitle}
      closeAccessibilityLabel={copy.cancel}
      onClose={props.onClose}
      onHidden={props.onHidden}
    >
      <ProductSheetAction
        icon={<PencilIcon size={icon} color={ink} />}
        label={copy.editLabel}
        onPress={props.onEdit}
      />
      <ProductSheetAction
        icon={<CameraIcon size={icon} color={ink} />}
        label={props.photosLabel}
        onPress={props.onPhotos}
      />
      <ProductSheetAction
        icon={
          props.archived ? (
            <RotateCcwIcon size={icon} color={ink} />
          ) : (
            <ArchiveIcon size={icon} color={danger} />
          )
        }
        label={props.archived ? copy.restoreProduct : copy.archiveProduct}
        danger={!props.archived}
        onPress={props.onStatus}
      />
    </Sheet>
  );
}
