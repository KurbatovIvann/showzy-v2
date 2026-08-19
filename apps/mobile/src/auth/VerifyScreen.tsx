import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useAuthSession } from "./AuthSession";
import { errorCopy, interpolate, verifyMessage } from "./copy";
import { identifierDestination } from "./identifiers";
import { AuthButton, AuthCard, Banner, OtpBoxes } from "./ui";

export function VerifyScreen() {
  const auth = useAuthSession();
  const flow = auth.flow;
  const state = useSyncExternalStore(
    (listener) => (flow === null ? emptySubscribe() : flow.subscribe(listener)),
    () => (flow === null ? emptyVerify() : flow.get()),
    () => (flow === null ? emptyVerify() : flow.get()),
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    if (state.step !== "verify") {
      return;
    }
    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [state.step]);

  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  if (flow === null || state.step !== "verify") {
    return <Redirect href="/sign-in" />;
  }

  const remaining = flow.resendSecondsRemaining();
  const destination = identifierDestination(state.identifier);
  const locked = state.codeError === "verify_locked";

  return (
    <SafeAreaView
      style={styles.screen}
      accessibilityLabel={auth.copy.verifyTitle}
    >
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          flow.back();
        }}
        style={styles.back}
      >
        <Text style={styles.backLabel}>
          {state.identifier.channel === "phone"
            ? auth.copy.wrongNumber
            : auth.copy.wrongEmail}
        </Text>
      </Pressable>
      <Text style={styles.title}>{auth.copy.verifyTitle}</Text>
      <Text style={styles.subtitle}>
        {verifyMessage(auth.copy, state.identifier.channel, destination)}
      </Text>
      <AuthCard>
        <OtpBoxes
          value={state.code}
          disabled={state.busy || locked}
          error={state.codeError !== null}
          accessibilityLabel={auth.copy.verifyCode}
          onChange={(code) => {
            flow.setCode(code);
            if (code.length === 6) {
              void flow.submitCode();
            }
          }}
        />
        {state.codeError ? (
          <Banner message={errorCopy(auth.copy, state.codeError)} />
        ) : null}
        {state.bannerError ? (
          <Banner message={errorCopy(auth.copy, state.bannerError)} />
        ) : null}
        <AuthButton
          label={auth.copy.verifyCode}
          loading={state.busy}
          disabled={locked}
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
            >
              <Text style={styles.resendAction}>{auth.copy.resendCode}</Text>
            </Pressable>
          )}
        </View>
      </AuthCard>
    </SafeAreaView>
  );
}

function emptySubscribe(): () => void {
  return () => undefined;
}

function emptyVerify() {
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
  back: {
    marginBottom: theme.spacing["3xl"],
    minHeight: 44,
    justifyContent: "center",
  },
  backLabel: {
    color: theme.colors.primary,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  title: {
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing["3xl"],
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  resend: {
    marginTop: theme.spacing.sm,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  resendWait: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  resendAction: {
    color: theme.colors.primary,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
}));
