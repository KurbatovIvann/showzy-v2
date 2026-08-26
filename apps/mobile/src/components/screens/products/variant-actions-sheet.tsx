import { ArchiveIcon, PencilIcon, RotateCcwIcon } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";

import type { ProductsDetailCopy } from "../../../i18n/products";
import { Sheet } from "../../ui";
import { ProductSheetAction } from "./product-sheet-action";

/**
 * Canvas `VariantActionsSheet`: Редагувати / Архівувати|Відновити.
 */
export function VariantActionsSheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly archived: boolean;
  readonly copy: ProductsDetailCopy;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onStatus: () => void;
}) {
  const { theme } = useUnistyles();
  const ink = theme.colors.foreground;
  const danger = theme.colors.destructive;
  const icon = theme.iconSize.sm;
  return (
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose}>
      <ProductSheetAction
        icon={<PencilIcon size={icon} color={ink} />}
        label={props.copy.editLabel}
        onPress={props.onEdit}
      />
      <ProductSheetAction
        icon={
          props.archived ? (
            <RotateCcwIcon size={icon} color={ink} />
          ) : (
            <ArchiveIcon size={icon} color={danger} />
          )
        }
        label={
          props.archived ? props.copy.restoreVariant : props.copy.archiveVariant
        }
        danger={!props.archived}
        onPress={props.onStatus}
      />
    </Sheet>
  );
}
