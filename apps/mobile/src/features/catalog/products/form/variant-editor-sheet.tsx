import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import type { ProductsFormCopy } from "../../../../i18n/products";
import {
  Banner,
  Button,
  Sheet,
  SwitchRow,
  TextField,
} from "../../../../components/ui";
import {
  isNameErrorKey,
  isPriceErrorKey,
  variantSheetResolver,
} from "./product-form.schema";
import {
  variantDraftToSheet,
  variantSheetPriceText,
  type ProductFormVariantDraft,
  type VariantSheetDraft,
} from "./product-form-model";

const UAH_SUFFIX = "₴";

export function VariantEditorSheet(props: {
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
  const { control, handleSubmit, reset, watch, setValue, formState } = useForm({
    defaultValues: variantDraftToSheet(null),
    resolver: variantSheetResolver,
    mode: "onSubmit",
  });
  const customPrice = watch("customPrice");
  const showErrors = formState.isSubmitted;

  useEffect(() => {
    if (!props.visible) {
      return;
    }
    reset(variantDraftToSheet(props.initial));
  }, [props.visible, props.initial, reset]);

  const nameKey = formState.errors.name?.message;
  const priceKey = formState.errors.priceText?.message;
  const nameError =
    showErrors && nameKey !== undefined && isNameErrorKey(nameKey)
      ? nameKey === "required"
        ? copy.errors.nameRequired
        : copy.errors.nameTooLong
      : null;
  const priceError =
    showErrors && priceKey !== undefined && isPriceErrorKey(priceKey)
      ? priceKey === "required"
        ? copy.errors.priceRequired
        : copy.errors.priceInvalid
      : null;

  function onValid(draft: VariantSheetDraft): void {
    props.onSave({
      name: draft.name,
      priceText: variantSheetPriceText(draft),
    });
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
            void handleSubmit(onValid)();
          }}
        />
      }
    >
      {props.banner != null && props.banner.length > 0 ? (
        <Banner message={props.banner} />
      ) : null}
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label={copy.variantSheetNameLabel}
            value={field.value}
            onChangeText={field.onChange}
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
        )}
      />
      <Controller
        control={control}
        name="customPrice"
        render={({ field }) => (
          <SwitchRow
            label={copy.variantSheetCustomPrice}
            description={copy.variantSheetCustomPriceDescription}
            checked={field.value}
            disabled={!props.editable}
            onChange={(checked) => {
              field.onChange(checked);
              if (!checked) {
                setValue("priceText", "");
              }
            }}
          />
        )}
      />
      {customPrice ? (
        <Controller
          control={control}
          name="priceText"
          render={({ field }) => (
            <TextField
              label={copy.variantSheetPriceLabel}
              value={field.value}
              onChangeText={field.onChange}
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
          )}
        />
      ) : null}
    </Sheet>
  );
}
