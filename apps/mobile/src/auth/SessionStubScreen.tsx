import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useAuthSession } from "./AuthSession";
import { isPlaceholderEmail } from "./identifiers";
import { AuthButton, AuthCard } from "./ui";

export function SessionStubScreen() {
  const auth = useAuthSession();

  if (auth.status === "loading") {
    return null;
  }
  if (auth.status !== "authenticated" || auth.session === null) {
    return <Redirect href="/sign-in" />;
  }

  const email = isPlaceholderEmail(auth.session.email)
    ? null
    : auth.session.email;

  return (
    <SafeAreaView
      style={styles.screen}
      accessibilityLabel={auth.copy.sessionTitle}
    >
      <Text style={styles.title}>{auth.copy.sessionTitle}</Text>
      <AuthCard>
        <Text style={styles.label}>{auth.copy.userId}</Text>
        <Text style={styles.value}>{auth.session.userId}</Text>
        {auth.session.phoneNumber ? (
          <>
            <Text style={styles.label}>{auth.copy.phone}</Text>
            <Text style={styles.value}>{auth.session.phoneNumber}</Text>
          </>
        ) : null}
        {email ? (
          <>
            <Text style={styles.label}>{auth.copy.email}</Text>
            <Text style={styles.value}>{email}</Text>
          </>
        ) : null}
        <Text style={styles.label}>{auth.copy.companySelector}</Text>
        <View
          accessibilityLabel={auth.copy.companySelector}
          style={styles.stub}
        >
          <Text style={styles.stubValue}>{auth.copy.companySelectorStub}</Text>
        </View>
        <AuthButton
          label={auth.copy.signOut}
          onPress={() => {
            void auth.signOut();
          }}
        />
      </AuthCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing["3xl"],
  },
  title: {
    color: theme.colors.foreground,
    marginBottom: theme.spacing["2xl"],
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "700",
  },
  label: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  value: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  stub: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    backgroundColor: theme.colors.muted,
  },
  stubValue: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
}));
