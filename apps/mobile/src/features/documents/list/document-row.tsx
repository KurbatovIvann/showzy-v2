import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PenLineIcon,
} from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, StatusPill } from "../../../components/ui";

export const DocumentRow = memo(function DocumentRow(props: {
  readonly id: string;
  readonly documentNumber: string;
  readonly typeLabel: string;
  readonly buyerLabel: string;
  readonly issuedOnLabel: string;
  readonly totalLabel: string;
  readonly cancelled: boolean;
  readonly cancelledBadge: string;
  readonly signedBadge: string;
  readonly showSign: boolean;
  readonly showSignedChip: boolean;
  readonly signButton: string;
  readonly optionsA11y: string;
  readonly optionsButton: string;
  readonly disabled: boolean;
  readonly onSign: (id: string) => void;
  readonly onOptions: (id: string) => void;
}) {
  const { theme } = useUnistyles();
  const iconColor = theme.colors.icon.muted;

  return (
    <View style={[styles.body, props.cancelled ? styles.cancelled : null]}>
      <View style={styles.header}>
        <StatusPill label={props.typeLabel} />
        {props.cancelled ? (
          <StatusPill label={props.cancelledBadge} tone="danger" />
        ) : null}
        {props.showSignedChip ? (
          <StatusPill label={props.signedBadge} tone="success" />
        ) : null}
      </View>
      <View style={styles.numberRow}>
        <FileTextIcon size={theme.iconSize.sm} color={iconColor} />
        <Text numberOfLines={1} style={styles.number}>
          {props.documentNumber}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.buyer}>
        {props.buyerLabel}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{props.issuedOnLabel}</Text>
        <Text style={styles.total}>{props.totalLabel}</Text>
      </View>
      <View style={styles.footer}>
        {props.showSign ? (
          <View style={styles.sign}>
            <Button
              fullWidth
              disabled={props.disabled}
              icon={<SignIcon />}
              label={props.signButton}
              onPress={() => {
                props.onSign(props.id);
              }}
            />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.optionsA11y}
          disabled={props.disabled}
          onPress={() => {
            props.onOptions(props.id);
          }}
          style={({ pressed }) => [
            props.showSign ? styles.optionsCompact : styles.options,
            pressed ? styles.pressed : null,
            props.disabled ? styles.disabled : null,
          ]}
        >
          <MoreHorizontalIcon
            size={theme.iconSize.sm}
            color={theme.colors.foreground}
          />
          {props.showSign ? null : (
            <Text style={styles.optionsLabel}>{props.optionsButton}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
});

function SignIcon() {
  const { theme } = useUnistyles();
  return (
    <PenLineIcon
      size={theme.iconSize.sm}
      color={theme.colors.primaryForeground}
    />
  );
}

export function DocumentRowSkeleton() {
  return (
    <View style={styles.body} accessibilityElementsHidden>
      <View style={[styles.skeletonLine, styles.skeletonBadge]} />
      <View style={[styles.skeletonLine, styles.skeletonTitle]} />
      <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      <View style={styles.skeletonFooter} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cancelled: {
    opacity: 0.72,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  number: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  buyer: {
    color: theme.colors.mutedForeground,
    // Class B: canvas 13 → typography.xs.
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  metaText: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  total: {
    color: theme.colors.foreground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  sign: {
    flex: 1,
    minWidth: 0,
  },
  options: {
    flex: 1,
    minHeight: theme.hitTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  optionsCompact: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  optionsLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonBadge: {
    height: theme.spacing.lg,
    width: "33%",
  },
  skeletonTitle: {
    height: theme.spacing.lg,
    width: "66%",
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
