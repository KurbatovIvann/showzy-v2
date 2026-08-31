import { TextInput, View } from "react-native";
import { SearchIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { keyboardAppearance } from "../../theme/tokens";

/**
 * Canvas list search: a raised capsule with a leading search icon.
 * Distinct from `TextField` (squircle form field) — do not merge them.
 */
export function SearchField(props: {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly maxLength?: number;
}) {
  const { theme, rt } = useUnistyles();
  return (
    <View style={styles.chrome}>
      <SearchIcon size={theme.iconSize.sm} color={theme.colors.icon.muted} />
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole="search"
        placeholderTextColor={theme.colors.icon.muted}
        keyboardAppearance={keyboardAppearance(rt.themeName)}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={props.maxLength}
        returnKeyType="search"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  chrome: {
    minHeight: theme.hitTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    paddingVertical: 0,
  },
}));
