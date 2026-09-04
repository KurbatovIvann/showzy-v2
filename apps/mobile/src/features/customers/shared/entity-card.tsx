import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ArchiveIcon, PencilIcon, Trash2Icon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button } from "../../../components/ui";

/**
 * Canvas `EntityCard` content inside `ListRow`. Outer card chrome lives
 * on `ListSurface`. Not a list-wide Pressable — there is no customer
 * detail ticket.
 */
export function EntityCard(props: {
  readonly title: string;
  readonly avatar: ReactNode;
  readonly badges?: ReactNode;
  readonly meta?: ReactNode;
  readonly editLabel: string;
  readonly showEdit: boolean;
  readonly onEdit: () => void;
  readonly removeLabel: string;
  readonly removeMode: "archive" | "delete";
  readonly showRemove: boolean;
  readonly onRemove: () => void;
  readonly extra?: ReactNode;
  readonly disabled?: boolean;
}) {
  const disabled = props.disabled === true;
  const showFooter = props.showEdit || props.showRemove;
  return (
    <View style={styles.body}>
      <View style={styles.header}>
        {props.avatar}
        <View style={styles.titles}>
          <Text style={styles.title}>{props.title}</Text>
          {props.badges != null ? (
            <View style={styles.badges}>{props.badges}</View>
          ) : null}
        </View>
      </View>
      {props.meta != null ? (
        <View style={styles.meta}>{props.meta}</View>
      ) : null}
      {showFooter ? (
        <View style={styles.footer}>
          {props.showEdit ? (
            <View style={styles.edit}>
              <Button
                fullWidth
                disabled={disabled}
                icon={<EditIcon />}
                label={props.editLabel}
                onPress={props.onEdit}
              />
            </View>
          ) : null}
          {props.showRemove ? (
            <RemoveIconButton
              mode={props.removeMode}
              accessibilityLabel={props.removeLabel}
              disabled={disabled}
              onPress={props.onRemove}
            />
          ) : null}
        </View>
      ) : null}
      {props.extra != null ? (
        <View style={styles.extra}>{props.extra}</View>
      ) : null}
    </View>
  );
}

export function EntityCardSkeleton() {
  return (
    <View style={styles.body} accessibilityElementsHidden>
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

export function EntityAvatar(props: { readonly children: ReactNode }) {
  return <View style={styles.avatar}>{props.children}</View>;
}

function EditIcon() {
  const { theme } = useUnistyles();
  return (
    <PencilIcon
      size={theme.iconSize.sm}
      color={theme.colors.primaryForeground}
    />
  );
}

function RemoveIconButton(props: {
  readonly mode: "archive" | "delete";
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const Icon = props.mode === "archive" ? ArchiveIcon : Trash2Icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.remove,
        pressed ? styles.pressed : null,
        props.disabled === true ? styles.disabled : null,
      ]}
    >
      <Icon size={theme.iconSize.sm} color={theme.colors.destructive} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
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
  extra: {
    flexDirection: "row",
  },
  remove: {
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
