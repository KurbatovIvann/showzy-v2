/**
 * Shared inline error copy (Banner + TextField). Do not fork a second
 * error strip — OtpInput keeps a tighter caption under the cells.
 */
export function fieldErrorTextStyle(theme: {
  readonly colors: { readonly destructive: string };
  readonly typography: {
    readonly sm: { readonly fontSize: number; readonly lineHeight: number };
  };
}): {
  readonly color: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: "500";
  readonly textAlign: "center";
} {
  return {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
    textAlign: "center",
  };
}
