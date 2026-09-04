import { Controller, useWatch, type Control } from "react-hook-form";

import type { ProductsFormCopy } from "../../../../i18n/products";
import { TextField } from "../../../../components/ui";
import {
  formatProductFormFooterPrice,
  productFormFieldChanged,
  type ProductFormDraft,
  type ProductFormMode,
} from "./product-form-draft";

const UAH_SUFFIX = "₴";

export function ProductFormNameField(props: {
  readonly control: Control<ProductFormDraft>;
  readonly copy: ProductsFormCopy;
  readonly mode: ProductFormMode;
  readonly originName: string;
  readonly nameMaxLength: number;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <Controller
      control={props.control}
      name="name"
      render={({ field }) => (
        <TextField
          label={props.copy.nameLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.namePlaceholder}
          accessibilityLabel={props.copy.nameLabel}
          keyboardType="default"
          autoCapitalize="sentences"
          autoCorrect
          autoComplete="off"
          maxLength={props.nameMaxLength}
          editable={props.editable}
          error={props.error}
          changed={productFormFieldChanged(
            props.mode,
            field.value,
            props.originName,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
    />
  );
}

export function ProductFormPriceField(props: {
  readonly control: Control<ProductFormDraft>;
  readonly copy: ProductsFormCopy;
  readonly mode: ProductFormMode;
  readonly originPriceText: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <Controller
      control={props.control}
      name="priceText"
      render={({ field }) => (
        <TextField
          label={props.copy.priceLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.pricePlaceholder}
          accessibilityLabel={props.copy.priceLabel}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          editable={props.editable}
          suffix={UAH_SUFFIX}
          error={props.error}
          changed={productFormFieldChanged(
            props.mode,
            field.value,
            props.originPriceText,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
    />
  );
}

export function useProductFormPriceLabel(
  control: Control<ProductFormDraft>,
): string {
  const priceText = useWatch({ control, name: "priceText" });
  return formatProductFormFooterPrice(priceText);
}
