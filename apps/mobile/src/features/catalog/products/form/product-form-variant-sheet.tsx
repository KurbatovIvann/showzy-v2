import { useEffect, useRef, useState } from "react";

import type { ProductsFormCopy } from "../../../../i18n/products";
import {
  Banner,
  Button,
  Sheet,
  SwitchRow,
  TextField,
} from "../../../../components/ui";
import {
  isVariantSheetValid,
  validateVariantSheet,
  variantDraftToSheet,
  variantSheetPriceText,
  type ProductFormVariantDraft,
  type VariantSheetDraft,
} from "./product-form-model";

const UAH_SUFFIX = "₴";

export function ProductFormVariantSheet(props: {
  readonly visible: boolean;
  readonly mode: "new" | "edit";
  readonly initial: ProductFormVariantDraft | null;
  readonly copy: ProductsFormCopy;
  readonly nameMaxLength: number;
  readonly editable: boolean;
  readonly onClose: () => void;
  readonly onSave: (input: {
    readonly name: string;
    readonly priceText: string;
  }) => void;
  readonly banner?: string | null;
}) {
  const { copy } = props;
  const [draft, setDraft] = useState<VariantSheetDraft>(() =>
    variantDraftToSheet(props.initial),
  );
  const [errors, setErrors] = useState(() =>
    validateVariantSheet(variantDraftToSheet(null)),
  );
  const [showErrors, setShowErrors] = useState(false);
  const wasVisible = useRef(false);

  useEffect(() => {
    const opened = props.visible && !wasVisible.current;
    wasVisible.current = props.visible;
    if (!opened) {
      return;
    }
    const next = variantDraftToSheet(props.initial);
    setDraft(next);
    setErrors(validateVariantSheet(next));
    setShowErrors(false);
  }, [props.visible, props.initial]);

  const nameError =
    showErrors && errors.name === "required"
      ? copy.errors.nameRequired
      : showErrors && errors.name === "too_long"
        ? copy.errors.nameTooLong
        : null;
  const priceError =
    showErrors && errors.price === "required"
      ? copy.errors.priceRequired
      : showErrors && errors.price === "invalid"
        ? copy.errors.priceInvalid
        : null;

  function patch(next: VariantSheetDraft): void {
    setDraft(next);
    setErrors(validateVariantSheet(next));
  }

  return (
    <Sheet
      visible={props.visible}
      title={
        props.mode === "new"
          ? copy.variantSheetNewTitle
          : copy.variantSheetEditTitle
      }
      fullHeight
      closeAccessibilityLabel={copy.closeSheet}
      onClose={props.onClose}
      footer={
        <Button
          fullWidth
          label={copy.variantSheetSave}
          disabled={!props.editable}
          onPress={() => {
            const nextErrors = validateVariantSheet(draft);
            setErrors(nextErrors);
            if (!isVariantSheetValid(nextErrors)) {
              setShowErrors(true);
              return;
            }
            props.onSave({
              name: draft.name,
              priceText: variantSheetPriceText(draft),
            });
          }}
        />
      }
    >
      {props.banner != null && props.banner.length > 0 ? (
        <Banner message={props.banner} />
      ) : null}
      <TextField
        label={copy.variantSheetNameLabel}
        value={draft.name}
        onChangeText={(value) => {
          patch({ ...draft, name: value });
        }}
        placeholder={copy.variantSheetNamePlaceholder}
        accessibilityLabel={copy.variantSheetNameLabel}
        keyboardType="default"
        autoCapitalize="sentences"
        autoCorrect
        autoComplete="off"
        maxLength={props.nameMaxLength}
        editable={props.editable}
        error={nameError}
      />
      <SwitchRow
        label={copy.variantSheetCustomPrice}
        description={copy.variantSheetCustomPriceDescription}
        checked={draft.customPrice}
        disabled={!props.editable}
        onChange={(checked) => {
          patch({ ...draft, customPrice: checked });
        }}
      />
      {draft.customPrice ? (
        <TextField
          label={copy.variantSheetPriceLabel}
          value={draft.priceText}
          onChangeText={(value) => {
            patch({ ...draft, priceText: value });
          }}
          placeholder={copy.pricePlaceholder}
          accessibilityLabel={copy.variantSheetPriceLabel}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          editable={props.editable}
          suffix={UAH_SUFFIX}
          error={priceError}
        />
      ) : null}
    </Sheet>
  );
}
