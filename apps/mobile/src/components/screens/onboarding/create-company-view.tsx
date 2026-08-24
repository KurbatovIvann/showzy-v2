import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Banner, Button, TextField } from "../../ui";
import { AuthPanel } from "../auth/auth-panel";
import { AuthScreen } from "../auth/auth-screen";
import type { useCreateCompany } from "./use-create-company";

export function CreateCompanyView(model: ReturnType<typeof useCreateCompany>) {
  return (
    <AuthScreen accessibilityLabel={model.copy.title}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {model.copy.title}
        </Text>
        <Text style={styles.subtitle}>{model.copy.subtitle}</Text>
      </View>
      <AuthPanel>
        <View style={styles.form}>
          <TextField
            size="auth"
            label={model.copy.nameLabel}
            value={model.name}
            onChangeText={model.changeName}
            placeholder={model.copy.namePlaceholder}
            accessibilityLabel={model.copy.nameLabel}
            keyboardType="default"
            autoCapitalize="words"
            autoCorrect
            autoComplete="organization"
            maxLength={120}
            editable={model.fieldsEditable}
            error={model.nameError}
          />
          <View>
            <TextField
              size="auth"
              label={model.copy.slugLabel}
              value={model.slug}
              onChangeText={model.changeSlug}
              placeholder={model.copy.slugPlaceholder}
              accessibilityLabel={model.copy.slugLabel}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={48}
              editable={model.fieldsEditable}
              error={model.slugError}
            />
            {model.copy.slugHint.length > 0 ? (
              <Text style={styles.hint}>{model.copy.slugHint}</Text>
            ) : null}
          </View>
          {model.banner !== null && model.banner.length > 0 ? (
            <Banner message={model.banner} />
          ) : null}
          <Button
            size="auth"
            label={model.submitLabel}
            loading={model.pending}
            disabled={model.submitDisabled}
            onPress={model.submit}
          />
        </View>
      </AuthPanel>
    </AuthScreen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingTop: theme.spacing["3xl"],
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography["4xl"].fontSize,
    lineHeight: theme.typography["4xl"].lineHeight,
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  form: {
    gap: theme.spacing.xl,
  },
  hint: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
}));
