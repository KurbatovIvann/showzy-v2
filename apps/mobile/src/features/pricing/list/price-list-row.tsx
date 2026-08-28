import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { MoreHorizontalIcon, PencilIcon, TagIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, StatusPill } from "../../../components/ui";
import { priceListRowActions } from "./price-lists-list.presenter";

export const PriceListRow = memo(function PriceListRow(props: {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly pricesLabel: string;
  readonly defaultBadge: string;
  readonly inactiveBadge: string;
  readonly editLabel: string;
  readonly optionsA11y: string;
  readonly canManage: boolean;
  readonly disabled: boolean;
  readonly onEdit: (id: string) => void;
  readonly onOptions: (id: string) => void;
}) {
  const { theme } = useUnistyles();
  const actions = priceListRowActions({ canManage: props.canManage });
  const iconColor = theme.colors.icon.muted;
  const showFooter = actions.showEdit || actions.showOptions;

  return (
    <View style={[styles.card, props.isActive ? null : styles.inactive]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <TagIcon size={theme.iconSize.sm} color={theme.colors.foreground} />
        </View>
        <View style={styles.titles}>
          <Text style={styles.title}>{props.name}</Text>
          {props.isDefault || !props.isActive ? (
            <View style={styles.badges}>
              {props.isDefault ? (
                <StatusPill label={props.defaultBadge} tone="action" />
              ) : null}
              {props.isActive ? null : (
                <StatusPill label={props.inactiveBadge} />
              )}
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <View style={styles.metaIcon}>
            <TagIcon size={theme.iconSize.sm} color={iconColor} />
          </View>
          <Text style={styles.metaText}>{props.pricesLabel}</Text>
        </View>
      </View>
      {showFooter ? (
        <View style={styles.footer}>
          {actions.showEdit ? (
            <View style={styles.edit}>
              <Button
                fullWidth
                disabled={props.disabled}
                icon={<EditIcon />}
                label={props.editLabel}
                onPress={() => {
                  props.onEdit(props.id);
                }}
              />
            </View>
          ) : null}
          {actions.showOptions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.optionsA11y}
              disabled={props.disabled}
              onPress={() => {
                props.onOptions(props.id);
              }}
              style={({ pressed }) => [
                styles.options,
                pressed ? styles.pressed : null,
                props.disabled ? styles.disabled : null,
              ]}
            >
              <MoreHorizontalIcon
                size={theme.iconSize.sm}
                color={theme.colors.foreground}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

function EditIcon() {
  const { theme } = useUnistyles();
  return (
    <PencilIcon
      size={theme.iconSize.sm}
      color={theme.colors.primaryForeground}
    />
  );
}

export function PriceListRowSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden>
      <View style={styles.header}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.titles}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonBadge]} />
        </View>
      </View>
      <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      <View style={styles.skeletonFooter} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    // Class B: canvas rounded-[20px] → radii.xl.
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  inactive: {
    opacity: 0.6,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  avatar: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.muted,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  meta: {
    gap: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  metaIcon: {
    marginTop: theme.spacing["2xs"],
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.mutedForeground,
    // Class B: canvas 13 → typography.xs.
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  edit: {
    flex: 1,
    minWidth: 0,
  },
  options: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  skeletonAvatar: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonTitle: {
    height: theme.spacing.lg,
    width: "66%",
  },
  skeletonBadge: {
    height: theme.spacing.md,
    width: "40%",
  },
  skeletonMeta: {
    height: theme.spacing.md,
    width: "50%",
  },
  skeletonFooter: {
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
}));
