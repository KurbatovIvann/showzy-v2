import { Controller, type Control } from "react-hook-form";

import type { CustomersGroupFormCopy } from "../../../i18n/customers";
import { TextField } from "../../../components/ui";
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_FORM_DESCRIPTION_LINES,
  GROUP_NAME_MAX,
} from "../shared/customer-caps";
import {
  groupFormFieldChanged,
  type GroupFormDraft,
  type GroupFormMode,
} from "./group-form-draft";

export function GroupFormNameField(props: {
  readonly control: Control<GroupFormDraft>;
  readonly copy: CustomersGroupFormCopy;
  readonly mode: GroupFormMode;
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
          autoCapitalize="words"
          autoCorrect
          autoComplete="off"
          maxLength={GROUP_NAME_MAX}
          editable={props.editable}
          error={props.error}
          changed={groupFormFieldChanged(
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

export function GroupFormDescriptionField(props: {
  readonly control: Control<GroupFormDraft>;
  readonly copy: CustomersGroupFormCopy;
  readonly mode: GroupFormMode;
  readonly originDescription: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <Controller
      control={props.control}
      name="description"
      render={({ field }) => (
        <TextField
          label={props.copy.descriptionLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.descriptionPlaceholder}
          accessibilityLabel={props.copy.descriptionLabel}
          keyboardType="default"
          autoCapitalize="sentences"
          autoCorrect
          autoComplete="off"
          maxLength={GROUP_DESCRIPTION_MAX}
          multiline
          numberOfLines={GROUP_FORM_DESCRIPTION_LINES}
          editable={props.editable}
          error={props.error}
          changed={groupFormFieldChanged(
            props.mode,
            field.value,
            props.originDescription,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
    />
  );
}
