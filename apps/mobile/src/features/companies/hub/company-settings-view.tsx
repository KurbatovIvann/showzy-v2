import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  FileTextIcon,
  HashIcon,
  LockIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Button, EmptyState } from "../../../components/ui";
import { CompanySettingsRow } from "./company-settings-row";
import type { CompanySettingsModel } from "./use-company-settings";

export function CompanySettingsView(model: CompanySettingsModel) {
  const { copy } = model;

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      <AppHeader
        title={copy.title}
        subtitle={model.identity?.name}
        back={{
          onPress: model.goBack,
          accessibilityLabel: copy.backLabel,
        }}
      />
      <CompanySettingsBody model={model} />
    </SafeAreaView>
  );
}

function CompanySettingsBody(props: { readonly model: CompanySettingsModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  switch (model.state.kind) {
    case "loading":
      return (
        <View style={styles.skeletons} accessibilityLabel={copy.loadingLabel}>
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonRow} />
        </View>
      );
    case "offline":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.offlineTitle}
            description={copy.offlineDescription}
            action={
              <Button
                variant="secondary"
                label={copy.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.errorTitle}
            description={copy.errorDescription}
            action={
              <Button
                variant="secondary"
                label={copy.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.permissionTitle}
            description={copy.permissionDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      if (model.identity === null || model.legalRow === null) {
        return null;
      }
      return (
        <CompanySettingsReady
          model={model}
          iconColor={theme.colors.mutedForeground}
        />
      );
  }
}

function CompanySettingsReady(props: {
  readonly model: CompanySettingsModel;
  readonly iconColor: string;
}) {
  const { model, iconColor } = props;
  const { copy, identity, legalRow } = model;
  const { theme } = useUnistyles();
  if (identity === null || legalRow === null) {
    return null;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.identityCard}>
        <Text style={styles.tradeName}>{identity.name}</Text>
        <Text selectable style={styles.slug}>
          {identity.slugDisplay}
        </Text>
        <View style={styles.prefixRow}>
          <View style={styles.iconWell}>
            <HashIcon size={theme.iconSize.md} color={iconColor} />
          </View>
          <View style={styles.prefixCopy}>
            <View style={styles.prefixHeading}>
              <Text style={styles.prefixTitle}>{copy.prefixTitle}</Text>
              <View style={styles.prefixBadge}>
                <Text style={styles.prefixBadgeLabel}>{identity.prefix}</Text>
              </View>
            </View>
            <Text style={styles.prefixExplanation}>
              {identity.prefixExplanation}
            </Text>
          </View>
        </View>
      </View>
      {/* Canvas "Про компанію" omitted — public profile / slug change is a stop. */}
      <Text style={styles.sectionTitle}>{copy.documentsSection}</Text>
      <View style={styles.group}>
        <CompanySettingsRow
          label={copy.legalLabel}
          description={legalRow.description}
          attention={legalRow.attention}
          onPress={model.openLegal}
          icon={<FileTextIcon size={theme.iconSize.md} color={iconColor} />}
        />
      </View>
    </ScrollView>
  );
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  identityCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  tradeName: {
    color: theme.colors.foreground,
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
  },
  slug: {
    marginTop: theme.spacing.xs,
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  prefixRow: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  iconWell: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  prefixCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  prefixHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  prefixTitle: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  prefixBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  prefixBadgeLabel: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  prefixExplanation: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  sectionTitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  group: {
    overflow: "hidden",
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    ...theme.shadows.sm,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
  skeletons: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  skeletonCard: {
    height: theme.hitTarget.row + theme.spacing["3xl"],
    borderRadius: theme.radii.card,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonRow: {
    height: theme.hitTarget.row,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
}));
