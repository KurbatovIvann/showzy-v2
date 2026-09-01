import type { Control } from "react-hook-form";

import type { CustomersGroupFormCopy } from "../../../i18n/customers";
import { FormTextField } from "../../../components/form-kit";
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
    <FormTextField
      control={props.control}
      name="name"
      label={props.copy.nameLabel}
      placeholder={props.copy.namePlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      changed={(value) =>
        groupFormFieldChanged(props.mode, value, props.originName)
      }
      changedLabel={props.copy.changedLabel}
      maxLength={GROUP_NAME_MAX}
      autoCapitalize="words"
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
    <FormTextField
      control={props.control}
      name="description"
      label={props.copy.descriptionLabel}
      placeholder={props.copy.descriptionPlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      changed={(value) =>
        groupFormFieldChanged(props.mode, value, props.originDescription)
      }
      changedLabel={props.copy.changedLabel}
      maxLength={GROUP_DESCRIPTION_MAX}
      multiline
      numberOfLines={GROUP_FORM_DESCRIPTION_LINES}
    />
  );
}
