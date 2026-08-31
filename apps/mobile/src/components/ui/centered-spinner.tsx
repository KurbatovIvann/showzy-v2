import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/** Guard-layout loading chrome (auth / signed-in shells). */
export function CenteredSpinner(props: {
  readonly accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.center} accessibilityLabel={props.accessibilityLabel}>
      <ActivityIndicator color={theme.colors.activityIndicator.onBackground} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
}));
