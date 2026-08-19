import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useAuthSession } from "./AuthSession";
import { errorCopy } from "./copy";
import { AuthButton, AuthCard, AuthField, AuthTabs, Banner } from "./ui";

export function SignInScreen() {
  const auth = useAuthSession();
  const flow = auth.flow;
  const state = useSyncExternalStore(
    (listener) => (flow === null ? emptySubscribe() : flow.subscribe(listener)),
    () => (flow === null ? emptyIdentifier() : flow.get()),
    () => (flow === null ? emptyIdentifier() : flow.get()),
  );

  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  if (flow === null || state.step !== "identifier") {
    if (state.step === "verify") {
      return <Redirect href="/verify" />;
    }
    return null;
  }

  const fieldError =
    state.fieldError === null ? null : errorCopy(auth.copy, state.fieldError);

  return (
    <SafeAreaView style={styles.screen} accessibilityLabel={auth.copy.welcome}>
      <View style={styles.branding}>
        <Text style={styles.title}>Showzy</Text>
        <Text style={styles.subtitle}>{auth.copy.welcomeMessage}</Text>
      </View>
      <AuthCard>
        <Text style={styles.cardTitle}>{auth.copy.welcome}</Text>
        <AuthTabs
          phoneLabel={auth.copy.phone}
          emailLabel={auth.copy.email}
          selected={state.channel}
          disabled={state.busy}
          onChange={(channel) => {
            flow.setChannel(channel);
          }}
        />
        {state.channel === "phone" ? (
          <AuthField
            value={state.phone}
            onChangeText={(value) => {
              flow.setPhone(value);
            }}
            placeholder={auth.copy.phonePlaceholder}
            accessibilityLabel={auth.copy.phone}
            keyboardType="phone-pad"
            editable={!state.busy}
            error={fieldError}
          />
        ) : (
          <AuthField
            value={state.email}
            onChangeText={(value) => {
              flow.setEmail(value);
            }}
            placeholder={auth.copy.emailPlaceholder}
            accessibilityLabel={auth.copy.email}
            keyboardType="email-address"
            editable={!state.busy}
            error={fieldError}
          />
        )}
        {state.bannerError ? (
          <Banner message={errorCopy(auth.copy, state.bannerError)} />
        ) : null}
        <AuthButton
          label={auth.copy.continue}
          loading={state.busy}
          onPress={() => {
            void flow.submitIdentifier();
          }}
        />
      </AuthCard>
    </SafeAreaView>
  );
}

function emptySubscribe(): () => void {
  return () => undefined;
}

function emptyIdentifier() {
  return {
    step: "identifier" as const,
    channel: "phone" as const,
    phone: "",
    email: "",
    fieldError: null,
    bannerError: null,
    busy: false,
  };
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  branding: {
    marginBottom: theme.spacing["3xl"],
    marginTop: theme.spacing.lg,
    alignItems: "center",
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography["4xl"].fontSize,
    lineHeight: theme.typography["4xl"].lineHeight,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  cardTitle: {
    color: theme.colors.foreground,
    textAlign: "center",
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "700",
  },
}));
