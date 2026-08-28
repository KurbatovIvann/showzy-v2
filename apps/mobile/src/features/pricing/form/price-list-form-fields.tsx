import { Controller, type Control } from "react-hook-form";

import type { PricingFormCopy } from "../../../i18n/pricing";
import { TextField } from "../../../components/ui";
import { PRICE_LIST_NAME_MAX } from "../shared/price-list-caps";
import {
  priceListFormFieldChanged,
  type PriceListFormDraft,
  type PriceListFormMode,
} from "./price-list-form-draft";

export function PriceListFormNameField(props: {
  readonly control: Control<PriceListFormDraft>;
  readonly copy: PricingFormCopy;
  readonly mode: PriceListFormMode;
  readonly originName: string;
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
          maxLength={PRICE_LIST_NAME_MAX}
          editable={props.editable}
          error={props.error}
          changed={priceListFormFieldChanged(
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
