import type { ReactNode } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/** Auth chrome: safe-area frame plus keyboard-aware scroll.
 * Keep SafeAreaView (headers are hidden; contentInsetAdjustmentBehavior
 * is iOS-centric). KeyboardProvider is at the root. */
export function AuthScreen(props: {
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
  readonly keyboard?: boolean;
}) {
  const { theme } = useUnistyles();
  return (
    <SafeAreaView
      style={styles.screen}
      accessibilityLabel={props.accessibilityLabel}
    >
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.lg}
        enabled={props.keyboard !== false}
      >
        {props.children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
  },
}));
