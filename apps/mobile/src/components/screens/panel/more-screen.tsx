import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Building2Icon,
  ChevronRightIcon,
  FileTextIcon,
  TagsIcon,
  type LucideIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useAuthSession } from "../../../auth/session-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { companySettingsHref } from "../../../features/companies/shared/company-hrefs";
import { documentsHref } from "../../../features/documents/shared/document-hrefs";
import { priceListsHref } from "../../../features/pricing/shared/price-list-hrefs";
import { detectLocale } from "../../../i18n/locale";
import { panelCopy } from "../../../i18n/panel";
import { Button, Card } from "../../ui";
import { moreRowState } from "./more-rows.presenter";

/**
 * More (Ще) tab: canvas Керування (price lists + documents) plus
 * Налаштування компанії for owner/admin. Team / User stay omitted
 * (no RBAC this ticket). Session / sign-out stay at the bottom.
 */
export function MoreScreen() {
  const copy = useMemo(() => panelCopy(detectLocale()), []);
  const auth = useAuthSession();
  const membership = useResolvedCompany();
  const router = useRouter();
  const rows = moreRowState(membership.role);

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
        <Text style={styles.sectionTitle}>{copy.more.management}</Text>
        <View style={styles.group}>
          <ManagementRow
            label={copy.more.documents}
            description={copy.more.documentsDescription}
            icon={FileTextIcon}
            disabled={!rows.documentsEnabled}
            accessibilityHint={
              rows.documentsEnabled
                ? undefined
                : copy.more.documentsDisabledHint
            }
            onPress={
              rows.documentsEnabled
                ? () => {
                    router.push(documentsHref());
                  }
                : undefined
            }
          />
          {rows.showPriceLists ? (
            <ManagementRow
              label={copy.more.priceLists}
              description={copy.more.priceListsDescription}
              icon={TagsIcon}
              divided
              onPress={() => {
                router.push(priceListsHref());
              }}
            />
          ) : null}
        </View>
        {rows.showCompanySettings ? (
          <>
            <Text style={styles.sectionTitle}>{copy.more.settings}</Text>
            <View style={styles.group}>
              <ManagementRow
                label={copy.more.companySettings}
                description={copy.more.companySettingsDescription}
                icon={Building2Icon}
                onPress={() => {
                  router.push(companySettingsHref());
                }}
              />
            </View>
          </>
        ) : null}
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

function ManagementRow(props: {
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly divided?: boolean;
  readonly accessibilityHint?: string;
}) {
  const { theme } = useUnistyles();
  const disabled = props.disabled === true;
  const Icon = props.icon;
  const iconColor = disabled
    ? theme.colors.icon.muted
    : theme.colors.mutedForeground;
  const chevronColor = theme.colors.icon.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.managementRow,
        props.divided === true ? styles.managementRowDivided : null,
        disabled ? styles.managementRowDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View style={styles.managementIconWell}>
        <Icon size={theme.iconSize.md} color={iconColor} />
      </View>
      <View style={styles.managementCopy}>
        <Text numberOfLines={1} style={styles.managementLabel}>
          {props.label}
        </Text>
        <Text numberOfLines={1} style={styles.managementDescription}>
          {props.description}
        </Text>
      </View>
      <ChevronRightIcon size={theme.iconSize.sm} color={chevronColor} />
    </Pressable>
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
        accessible
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
  group: {
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    // Class B: canvas rounded-[20px] → radii.xl.
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.md,
  },
  managementRow: {
    // Class B: canvas min-h-[72px] / px-4 / py-3.5 / gap-3.
    minHeight: theme.hitTarget.min + theme.spacing["2xl"],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  managementRowDivided: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  managementRowDisabled: {
    opacity: 0.5,
  },
  managementIconWell: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  managementCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing["2xs"],
  },
  managementLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  managementDescription: {
    color: theme.colors.mutedForeground,
    // Class B: canvas 13 → typography.xs.
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  pressed: {
    backgroundColor: theme.colors.background,
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
