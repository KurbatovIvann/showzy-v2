import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useAuthSession } from "../auth/AuthSession";
import { errorCopy } from "../auth/copy";
import { AuthButton } from "../auth/ui";

export default function Index() {
  const auth = useAuthSession();
  const { theme } = useUnistyles();

  if (auth.configError) {
    return (
      <View style={styles.center} accessibilityLabel="configuration error">
        <Text style={styles.message}>EXPO_PUBLIC_API_URL is not set</Text>
      </View>
    );
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

  if (auth.bootError !== null && auth.status === "anonymous") {
    return (
      <View style={styles.center} accessibilityLabel={auth.copy.retry}>
        <Text style={styles.message}>
          {errorCopy(auth.copy, auth.bootError)}
        </Text>
        <AuthButton
          label={auth.copy.retry}
          onPress={() => {
            void auth.retryHydrate();
          }}
        />
      </View>
    );
  }

  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  return <Redirect href="/sign-in" />;
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  message: {
    color: theme.colors.foreground,
    textAlign: "center",
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
}));
