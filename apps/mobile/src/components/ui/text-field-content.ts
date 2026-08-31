/**
 * TextInput autocomplete / content-type mapping. Keep this out of the
 * view so Vitest can prove QES passwords are not opted into iCloud
 * Keychain / Password AutoFill (owner decision 12).
 */
export type TextFieldAutoComplete =
  "email" | "tel" | "off" | "organization" | "password";

export type TextFieldKeyboardType =
  "phone-pad" | "email-address" | "default" | "decimal-pad" | "number-pad";

export const TEXT_FIELD_DEFAULT_KEYBOARD_TYPE =
  "default" satisfies TextFieldKeyboardType;

export type TextFieldContentType =
  "password" | "telephoneNumber" | "emailAddress" | "organizationName" | "none";

export function resolveTextFieldContent(args: {
  readonly secure: boolean;
  readonly autoComplete?: TextFieldAutoComplete | undefined;
  readonly keyboardType: TextFieldKeyboardType;
}): {
  readonly autoComplete: TextFieldAutoComplete;
  readonly textContentType: TextFieldContentType;
} {
  const phone = args.keyboardType === "phone-pad";
  const email = args.keyboardType === "email-address";
  const autoComplete =
    args.autoComplete ??
    (args.secure ? "password" : phone ? "tel" : email ? "email" : "off");
  const textContentType =
    autoComplete === "password"
      ? "password"
      : autoComplete === "off"
        ? "none"
        : autoComplete === "tel"
          ? "telephoneNumber"
          : autoComplete === "email"
            ? "emailAddress"
            : "organizationName";
  return { autoComplete, textContentType };
}
