import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { OtpProvider } from "../../auth/otp/provider";
import { useAuthSession } from "../../auth/session-provider";

export default function AuthLayout() {
  const auth = useAuthSession();
  const { theme } = useUnistyles();

  if (auth.configError) {
    return <Redirect href="/" />;
  }
  if (auth.status === "loading") {
    return (
      <View style={styles.center} accessibilityLabel={auth.copy.loading}>
        <ActivityIndicator
          color={theme.colors.activityIndicator.onBackground}
        />
      </View>
    );
  }
  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  if (auth.authClient === null) {
    return <Redirect href="/" />;
  }

  return (
    <OtpProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OtpProvider>
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
