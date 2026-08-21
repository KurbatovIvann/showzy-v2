import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { identifierDestination } from "../../../auth/identifiers";
import { authPolicy } from "../../../auth/policy";
import { useAuthSession } from "../../../auth/session-provider";
import { useOtpFlowState } from "../../../auth/use-otp-flow-state";
import { errorCopy } from "../../../i18n/auth";
import { interpolate } from "../../../i18n/locale";
import { Banner, Button, OtpInput } from "../../ui";
import { AuthPanel } from "./auth-panel";

export function VerifyScreen() {
  const auth = useAuthSession();
  const flow = auth.flow;
  const state = useOtpFlowState(flow);
  const { theme } = useUnistyles();
  const [, setTick] = useState(0);

  const remaining = flow === null ? 0 : flow.resendSecondsRemaining();
  const countdownActive = state.step === "verify" && remaining > 0;

  useEffect(() => {
    if (!countdownActive) {
      return;
    }
    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [countdownActive]);

  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  if (flow === null || state.step !== "verify") {
    return <Redirect href="/sign-in" />;
  }

  const destination = identifierDestination(state.identifier);
  const locked = state.codeError === "verify_locked";
  const otpError =
    state.codeError === null ? null : errorCopy(auth.copy, state.codeError);
  const submitDisabled = state.code.length === 0 || state.busy || locked;
  const messageTemplate =
    state.identifier.channel === "phone"
      ? auth.copy.verifyPhoneMessage
      : auth.copy.verifyEmailMessage;
  const [messageBefore, messageAfter = ""] =
    messageTemplate.split("{{destination}}");
  const backLabel =
    state.identifier.channel === "phone"
      ? auth.copy.wrongNumber
      : auth.copy.wrongEmail;

  return (
    <SafeAreaView
      style={styles.screen}
      accessibilityLabel={auth.copy.verifyTitle}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={8}
        onPress={() => {
          flow.back();
        }}
        style={styles.back}
      >
        <ChevronLeft size={20} color={theme.colors.mutedForeground} />
        <Text style={styles.backLabel}>{backLabel}</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.title}>{auth.copy.verifyTitle}</Text>
        <Text style={styles.subtitle}>
          {messageBefore}
          <Text style={styles.destination}>{destination}</Text>
          {messageAfter}
        </Text>
      </View>
      <AuthPanel>
        <OtpInput
          value={state.code}
          length={authPolicy.otpLength}
          disabled={state.busy || locked}
          error={otpError ?? false}
          accessibilityLabel={auth.copy.verifyCode}
          onChange={(code) => {
            flow.setCode(code);
            if (code.length === authPolicy.otpLength) {
              void flow.submitCode();
            }
          }}
        />
        {state.bannerError ? (
          <Banner message={errorCopy(auth.copy, state.bannerError)} />
        ) : null}
        <View style={styles.actions}>
          <Button
            size="auth"
            label={state.busy ? auth.copy.verifyLoading : auth.copy.verifyCode}
            disabled={submitDisabled}
            onPress={() => {
              void flow.submitCode();
            }}
          />
          <View style={styles.resend}>
            {remaining > 0 ? (
              <Text style={styles.resendWait}>
                {interpolate(auth.copy.resendCodeIn, {
                  seconds: String(remaining),
                })}
              </Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={auth.copy.resendCode}
                disabled={state.resendBusy}
                onPress={() => {
                  void flow.resend();
                }}
                style={styles.resendHit}
              >
                <Text style={styles.resendAction}>{auth.copy.resendCode}</Text>
              </Pressable>
            )}
          </View>
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
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginLeft: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    minHeight: theme.hitTarget.min,
  },
  backLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  header: {
    paddingTop: theme.spacing["3xl"],
    paddingBottom: theme.spacing["2xl"] + theme.spacing.sm,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography["4xl"].fontSize,
    lineHeight: theme.typography["4xl"].lineHeight,
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  destination: {
    color: theme.colors.foreground,
    fontWeight: "500",
  },
  actions: {
    gap: theme.spacing.lg,
  },
  resend: {
    alignItems: "center",
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
  },
  resendHit: {
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  resendWait: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  resendAction: {
    color: theme.colors.accent,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
}));
