import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useAuthSession } from "../../../auth/session-provider";
import { useOtpFlowState } from "../../../auth/use-otp-flow-state";
import type { AuthChannel } from "../../../auth/identifiers";
import { errorCopy } from "../../../i18n/auth";
import { Banner, Button, Card, SegmentedTabs, TextField } from "../../ui";

export function SignInScreen() {
  const auth = useAuthSession();
  const flow = auth.flow;
  const state = useOtpFlowState(flow);

  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  if (flow === null) {
    // Config error: the index route renders the actionable message.
    return <Redirect href="/" />;
  }
  if (state.step !== "identifier") {
    return <Redirect href="/verify" />;
  }

  const fieldError =
    state.fieldError === null ? null : errorCopy(auth.copy, state.fieldError);
  const channels: ReadonlyArray<{ key: AuthChannel; label: string }> = [
    { key: "phone", label: auth.copy.phone },
    { key: "email", label: auth.copy.email },
  ];

  return (
    <SafeAreaView style={styles.screen} accessibilityLabel={auth.copy.welcome}>
      <View style={styles.branding}>
        <Text style={styles.title}>Showzy</Text>
        <Text style={styles.subtitle}>{auth.copy.welcomeMessage}</Text>
      </View>
      <Card>
        <Text style={styles.cardTitle}>{auth.copy.welcome}</Text>
        <SegmentedTabs
          tabs={channels}
          selected={state.channel}
          disabled={state.busy}
          onSelect={(channel) => {
            flow.setChannel(channel);
          }}
        />
        {state.channel === "phone" ? (
          <TextField
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
          <TextField
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
        <Button
          label={auth.copy.continue}
          loading={state.busy}
          onPress={() => {
            void flow.submitIdentifier();
          }}
        />
      </Card>
    </SafeAreaView>
  );
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
