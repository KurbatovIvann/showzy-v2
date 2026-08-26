import { CameraIcon, ImagesIcon } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";

import type { ProductsPhotosCopy } from "../../../i18n/products";
import { Sheet } from "../../ui";
import { ProductSheetAction } from "./product-sheet-action";

/**
 * Canvas `PhotoSourceSheet`: Камера / Галерея as icon rows, not stacked
 * Buttons. Feature chrome on the product form.
 */
export function PhotoSourceSheet(props: {
  readonly visible: boolean;
  readonly copy: ProductsPhotosCopy;
  readonly onClose: () => void;
  readonly onCamera: () => void;
  readonly onLibrary: () => void;
}) {
  const { theme } = useUnistyles();
  const ink = theme.colors.mutedForeground;
  const icon = theme.iconSize.md;

  return (
    <Sheet
      visible={props.visible}
      title={props.copy.pickTitle}
      description={props.copy.pickDescription}
      closeAccessibilityLabel={props.copy.closeSheet}
      onClose={props.onClose}
    >
      <ProductSheetAction
        icon={<CameraIcon size={icon} color={ink} />}
        label={props.copy.addCamera}
        onPress={props.onCamera}
      />
      <ProductSheetAction
        icon={<ImagesIcon size={icon} color={ink} />}
        label={props.copy.addLibrary}
        onPress={props.onLibrary}
      />
    </Sheet>
  );
}
