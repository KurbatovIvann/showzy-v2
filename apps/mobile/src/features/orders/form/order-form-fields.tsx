import { Controller, type Control } from "react-hook-form";

import { TextField } from "../../../components/ui";
import type { OrdersCreateCopy } from "../../../i18n/orders";
import {
  CREATE_ORDER_COMMENT_MAX,
  ORDER_COMMENT_LINES,
} from "../shared/order-caps";
import type { OrderFormDraft } from "./order-form-draft";

export function OrderFormCommentField(props: {
  readonly control: Control<OrderFormDraft>;
  readonly copy: OrdersCreateCopy;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <Controller
      control={props.control}
      name="comment"
      render={({ field }) => (
        <TextField
          label={props.copy.commentLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.commentPlaceholder}
          accessibilityLabel={props.copy.commentLabel}
          keyboardType="default"
          autoCapitalize="sentences"
          autoCorrect
          autoComplete="off"
          maxLength={CREATE_ORDER_COMMENT_MAX}
          multiline
          numberOfLines={ORDER_COMMENT_LINES}
          editable={props.editable}
          error={props.error}
        />
      )}
    />
  );
}
