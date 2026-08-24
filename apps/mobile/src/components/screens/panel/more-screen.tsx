import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { useAuthSession } from "../../../auth/session-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { panelCopy } from "../../../i18n/panel";
import { Button, Card } from "../../ui";

/**
 * More (Ще) tab: session and verified company identity plus sign-out.
 * The company-resolution boundary proves membership before this screen
 * mounts. Bottom inset is owned by the tab bar.
 */
export function MoreScreen() {
  const copy = useMemo(() => panelCopy(detectLocale()), []);
  const auth = useAuthSession();
  const membership = useResolvedCompany();

  if (auth.session === null) {
    return null;
  }

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.tabs.more}
      style={styles.screen}
    >
      <Text style={styles.title}>{copy.tabs.more}</Text>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{copy.more.session}</Text>
        <Card>
          <IdentityField label={copy.more.userId} value={auth.session.userId} />
          {auth.session.phoneNumber !== null ? (
            <IdentityField
              label={copy.more.phone}
              value={auth.session.phoneNumber}
            />
          ) : null}
          {auth.session.email !== null ? (
            <IdentityField label={copy.more.email} value={auth.session.email} />
          ) : null}
          <ResolvedCompanyField
            label={copy.more.companySelector}
            value={membership.company.name}
          />
          <Button
            label={copy.more.signOut}
            onPress={() => {
              void auth.signOut();
            }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function IdentityField(props: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{props.label}</Text>
      <Text selectable style={styles.value}>
        {props.value}
      </Text>
    </View>
  );
}

function ResolvedCompanyField(props: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{props.label}</Text>
      <View
        accessibilityLabel={`${props.label}: ${props.value}`}
        style={styles.company}
      >
        <Text selectable style={styles.companyValue}>
          {props.value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.foreground,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.xl.fontSize,
    lineHeight: theme.typography.xl.lineHeight,
    fontWeight: "600",
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
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
  company: {
    minHeight: theme.hitTarget.field,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    backgroundColor: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  companyValue: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
}));
