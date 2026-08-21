import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { AtSign, Phone } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useSignInScreen } from "../../../auth/use-sign-in";
import { Banner, Button, SegmentedTabs, TextField } from "../../ui";
import { AuthBrand } from "./auth-brand";
import { AuthPanel } from "./auth-panel";

export function SignInScreen() {
  const model = useSignInScreen();
  const { theme } = useUnistyles();

  if (model.kind === "redirect-verify") {
    return <Redirect href="/verify" />;
  }

  const iconColor = theme.colors.mutedForeground;

  return (
    <SafeAreaView style={styles.screen} accessibilityLabel={model.copy.welcome}>
      <AuthBrand tagline={model.copy.tagline} />
      <AuthPanel>
        <Text style={styles.title}>{model.copy.welcome}</Text>
        <View style={styles.form}>
          <SegmentedTabs
            tabs={model.channels}
            selected={model.channel}
            disabled={model.busy}
            onSelect={model.setChannel}
          />
          {model.channel === "phone" ? (
            <TextField
              size="auth"
              label={model.copy.phoneLabel}
              leading={<Phone size={18} color={iconColor} />}
              prefix="+380"
              value={model.phoneDigits}
              onChangeText={model.setPhoneDigits}
              placeholder={model.copy.phonePlaceholder}
              accessibilityLabel={model.copy.phoneLabel}
              keyboardType="phone-pad"
              editable={!model.busy}
              error={model.fieldError}
            />
          ) : (
            <TextField
              size="auth"
              label={model.copy.emailLabel}
              leading={<AtSign size={18} color={iconColor} />}
              value={model.email}
              onChangeText={model.setEmail}
              placeholder={model.copy.emailPlaceholder}
              accessibilityLabel={model.copy.emailLabel}
              keyboardType="email-address"
              editable={!model.busy}
              error={model.fieldError}
            />
          )}
          {model.banner ? <Banner message={model.banner} /> : null}
          <Button
            size="auth"
            label={
              model.busy ? model.copy.continueLoading : model.copy.continue
            }
            disabled={model.submitDisabled}
            onPress={model.submit}
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
