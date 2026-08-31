import { Pressable, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useVerifyScreen } from "../../../auth/use-verify";
import { Banner, Button, OtpInput } from "../../ui";
import { AuthPanel } from "./auth-panel";
import { AuthScreen } from "./auth-screen";

export function VerifyScreen() {
  const model = useVerifyScreen();
  const { theme } = useUnistyles();

  if (model.kind === "redirect-sign-in") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <AuthScreen accessibilityLabel={model.copy.verifyTitle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={model.backLabel}
        hitSlop={theme.spacing.sm}
        onPress={model.back}
        style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
      >
        <ChevronLeft
          size={theme.iconSize.md}
          color={theme.colors.mutedForeground}
        />
        <Text style={styles.backLabel}>{model.backLabel}</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.title}>{model.copy.verifyTitle}</Text>
        <Text style={styles.subtitle}>
          {model.messageBefore}
          <Text selectable style={styles.destination}>
            {model.destination}
          </Text>
          {model.messageAfter}
        </Text>
      </View>
      <AuthPanel>
        <OtpInput
          value={model.code}
          length={model.otpLength}
          disabled={model.busy || model.locked}
          error={model.otpError != null}
          errorText={model.otpError ?? ""}
          accessibilityLabel={model.copy.verifyCode}
          onChange={(code) => {
            model.setCode(code);
            if (code.length === model.otpLength) {
              model.submit(code);
            }
          }}
        />
        {model.banner ? <Banner message={model.banner} /> : null}
        <View style={styles.actions}>
          <Button
            size="lg"
            label={
              model.busy ? model.copy.verifyLoading : model.copy.verifyCode
            }
            disabled={model.submitDisabled}
            onPress={model.submit}
          />
          <View style={styles.resend}>
            {model.resendWaitLabel !== null ? (
              <Text style={styles.resendWait}>{model.resendWaitLabel}</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={model.copy.resendCode}
                disabled={model.resendBusy}
                onPress={model.resend}
                style={({ pressed }) => [
                  styles.resendHit,
                  pressed && !model.resendBusy ? styles.pressed : null,
                ]}
              >
                <Text style={styles.resendAction}>{model.copy.resendCode}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </AuthPanel>
    </AuthScreen>
  );
}

const styles = StyleSheet.create((theme) => ({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginLeft: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    minHeight: theme.hitTarget.min,
  },
  pressed: {
    opacity: 0.85,
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
