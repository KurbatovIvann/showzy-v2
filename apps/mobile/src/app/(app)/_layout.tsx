import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useAuthSession } from "../../auth/session-provider";

export default function AppLayout() {
  const auth = useAuthSession();
  const { theme } = useUnistyles();

  if (auth.status === "loading") {
    return (
      <View style={styles.center} accessibilityLabel={auth.copy.loading}>
        <ActivityIndicator
          color={theme.colors.activityIndicator.onBackground}
        />
      </View>
    );
  }
  if (auth.status !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
}));
