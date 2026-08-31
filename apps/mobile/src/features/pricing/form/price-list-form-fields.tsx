import type { Control } from "react-hook-form";

import type { PricingFormCopy } from "../../../i18n/pricing";
import { FormTextField } from "../../../components/form-kit";
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
    <FormTextField
      control={props.control}
      name="name"
      label={props.copy.nameLabel}
      placeholder={props.copy.namePlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      changed={(value) =>
        priceListFormFieldChanged(props.mode, value, props.originName)
      }
      changedLabel={props.copy.changedLabel}
      maxLength={PRICE_LIST_NAME_MAX}
    />
  );
}
