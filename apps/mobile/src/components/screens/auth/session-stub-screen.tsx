import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useAuthSession } from "../../../auth/session-provider";
import { Button, Card } from "../../ui";
import { AuthScreen } from "./auth-screen";

export function SessionStubScreen() {
  const auth = useAuthSession();

  if (auth.session === null) {
    return null;
  }

  return (
    <AuthScreen accessibilityLabel={auth.copy.sessionTitle} keyboard={false}>
      <Text style={styles.title}>{auth.copy.sessionTitle}</Text>
      <Card>
        <Text style={styles.label}>{auth.copy.userId}</Text>
        <Text selectable style={styles.value}>
          {auth.session.userId}
        </Text>
        {auth.session.phoneNumber ? (
          <>
            <Text style={styles.label}>{auth.copy.phone}</Text>
            <Text selectable style={styles.value}>
              {auth.session.phoneNumber}
            </Text>
          </>
        ) : null}
        {auth.session.email ? (
          <>
            <Text style={styles.label}>{auth.copy.email}</Text>
            <Text selectable style={styles.value}>
              {auth.session.email}
            </Text>
          </>
        ) : null}
        <Text style={styles.label}>{auth.copy.companySelector}</Text>
        <View
          accessibilityLabel={auth.copy.companySelector}
          style={styles.stub}
        >
          <Text style={styles.stubValue}>{auth.copy.companySelectorStub}</Text>
        </View>
        <Button
          label={auth.copy.signOut}
          onPress={() => {
            void auth.signOut();
          }}
        />
      </Card>
    </AuthScreen>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    color: theme.colors.foreground,
    marginTop: theme.spacing["3xl"],
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
    minHeight: theme.hitTarget.field,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    ...theme.squircle,
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
