import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type PathValue,
  type RegisterOptions,
} from "react-hook-form";

import { TextField } from "../ui";

type StringFieldPath<TFieldValues extends FieldValues> = {
  [TName in FieldPath<TFieldValues>]: PathValue<
    TFieldValues,
    TName
  > extends string
    ? TName
    : never;
}[FieldPath<TFieldValues>];

function stringFieldValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function FormTextField<
  TFieldValues extends FieldValues,
  TName extends StringFieldPath<TFieldValues>,
>(props: {
  readonly control: Control<TFieldValues>;
  readonly name: TName;
  readonly label: string;
  readonly placeholder: string;
  readonly error: string | null;
  readonly editable: boolean;
  readonly onFieldEdit?: () => void;
  readonly changed?: boolean | ((value: string) => boolean);
  readonly changedLabel?: string;
  readonly rules?: Omit<
    RegisterOptions<TFieldValues, TName>,
    "valueAsNumber" | "valueAsDate" | "setValueAs" | "disabled"
  >;
  readonly keyboardType?:
    "phone-pad" | "email-address" | "default" | "number-pad" | "decimal-pad";
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
  readonly autoCorrect?: boolean;
  readonly autoComplete?: "email" | "tel" | "off" | "organization" | "password";
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly numberOfLines?: number;
  readonly secureTextEntry?: boolean;
}) {
  return (
    <Controller
      control={props.control}
      name={props.name}
      {...(props.rules !== undefined ? { rules: props.rules } : {})}
      render={({ field }) => {
        const value = stringFieldValue(field.value);
        const changed =
          typeof props.changed === "function"
            ? props.changed(value)
            : props.changed;
        return (
          <TextField
            label={props.label}
            value={value}
            onChangeText={(next) => {
              field.onChange(next);
              props.onFieldEdit?.();
            }}
            placeholder={props.placeholder}
            accessibilityLabel={props.label}
            keyboardType={props.keyboardType ?? "default"}
            autoCapitalize={props.autoCapitalize ?? "sentences"}
            autoCorrect={props.autoCorrect ?? true}
            autoComplete={props.autoComplete ?? "off"}
            multiline={props.multiline === true}
            editable={props.editable}
            error={props.error}
            changed={changed === true}
            {...(props.maxLength !== undefined
              ? { maxLength: props.maxLength }
              : {})}
            {...(props.multiline === true && props.numberOfLines !== undefined
              ? { numberOfLines: props.numberOfLines }
              : {})}
            {...(props.changedLabel !== undefined
              ? { changedLabel: props.changedLabel }
              : {})}
            {...(props.secureTextEntry === true
              ? { secureTextEntry: true }
              : {})}
          />
        );
      }}
    />
  );
}
