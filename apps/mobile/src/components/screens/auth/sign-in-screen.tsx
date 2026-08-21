import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { AtSign, Phone } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useAuthSession } from "../../../auth/session-provider";
import { useOtpFlowState } from "../../../auth/use-otp-flow-state";
import {
  uaNationalFieldDigits,
  uaPhoneFieldValue,
  type AuthChannel,
} from "../../../auth/identifiers";
import { errorCopy } from "../../../i18n/auth";
import { Banner, Button, SegmentedTabs, TextField } from "../../ui";
import { AuthBrand } from "./auth-brand";
import { AuthPanel } from "./auth-panel";

export function SignInScreen() {
  const auth = useAuthSession();
  const flow = auth.flow;
  const state = useOtpFlowState(flow);
  const { theme } = useUnistyles();

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
  const nationalDigits = uaNationalFieldDigits(state.phone);
  const identifierEmpty =
    state.channel === "phone"
      ? nationalDigits.length === 0
      : state.email.trim().length === 0;
  const submitDisabled = identifierEmpty || state.busy;
  const iconColor = theme.colors.mutedForeground;

  return (
    <SafeAreaView style={styles.screen} accessibilityLabel={auth.copy.welcome}>
      <AuthBrand tagline={auth.copy.tagline} />
      <AuthPanel>
        <Text style={styles.title}>{auth.copy.welcome}</Text>
        <View style={styles.form}>
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
              size="auth"
              label={auth.copy.phoneLabel}
              leading={<Phone size={18} color={iconColor} />}
              prefix="+380"
              value={nationalDigits}
              onChangeText={(value) => {
                flow.setPhone(uaPhoneFieldValue(value));
              }}
              placeholder={auth.copy.phonePlaceholder}
              accessibilityLabel={auth.copy.phoneLabel}
              keyboardType="phone-pad"
              editable={!state.busy}
              error={fieldError}
            />
          ) : (
            <TextField
              size="auth"
              label={auth.copy.emailLabel}
              leading={<AtSign size={18} color={iconColor} />}
              value={state.email}
              onChangeText={(value) => {
                flow.setEmail(value);
              }}
              placeholder={auth.copy.emailPlaceholder}
              accessibilityLabel={auth.copy.emailLabel}
              keyboardType="email-address"
              editable={!state.busy}
              error={fieldError}
            />
          )}
          {state.bannerError ? (
            <Banner message={errorCopy(auth.copy, state.bannerError)} />
          ) : null}
          <Button
            size="auth"
            label={state.busy ? auth.copy.continueLoading : auth.copy.continue}
            disabled={submitDisabled}
            onPress={() => {
              void flow.submitIdentifier();
            }}
          />
        </View>
      </AuthPanel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    color: theme.colors.foreground,
    textAlign: "center",
    fontSize: theme.typography["3xl"].fontSize,
    lineHeight: theme.typography["3xl"].lineHeight,
    fontWeight: "600",
  },
  form: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xl,
  },
}));
