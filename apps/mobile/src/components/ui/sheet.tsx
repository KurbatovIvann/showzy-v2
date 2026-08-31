import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ChevronLeftIcon, XIcon } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useSheetPresentation } from "./use-sheet-presentation";

/**
 * Canvas sheet: dim overlay (`colors.overlay`) and a bottom card with
 * `radii.sheet`. Confirmation callers keep `mode="actions"` (default).
 * Content callers pass `mode="content"` so children become the
 * scrollable body, with an optional `footer`. Host stays mounted;
 * `visible` drives open/close. Drag-to-dismiss is omitted — the close
 * control and Android back (`onRequestClose`) dismiss it.
 */
export type SheetBack = {
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
};

export type SheetMode = "actions" | "content";

export function Sheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly closeAccessibilityLabel: string;
  readonly description?: string;
  readonly mode?: SheetMode;
  readonly footer?: ReactNode;
  readonly fullHeight?: boolean;
  readonly back?: SheetBack | undefined;
  readonly onHidden?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const presentation = useSheetPresentation(props.visible, props.onHidden);
  const description =
    props.description != null && props.description.length > 0
      ? props.description
      : null;
  const mode = props.mode ?? "actions";
  const contentMode = mode === "content";
  const fullHeight = props.fullHeight === true;

  return (
    <Modal
      visible={presentation.presented}
      transparent
      animationType="none"
      onRequestClose={props.onClose}
      onDismiss={presentation.onModalDismiss}
      statusBarTranslucent
    >
      <View
        style={styles.host}
        pointerEvents={props.visible ? "box-none" : "none"}
      >
        <Pressable
          accessible={false}
          onPress={props.onClose}
          style={styles.overlayHit}
        >
          <Animated.View style={[styles.overlay, presentation.overlayStyle]} />
        </Pressable>
        <Animated.View
          accessibilityViewIsModal
          onLayout={presentation.onPanelLayout}
          style={[
            styles.panel,
            fullHeight ? styles.panelFull : styles.panelMax,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
            presentation.panelStyle,
          ]}
        >
          <View style={styles.grabber} />
          <SheetHeader
            title={props.title}
            closeAccessibilityLabel={props.closeAccessibilityLabel}
            onClose={props.onClose}
            back={props.back}
          />
          {description !== null ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          {contentMode ? (
            <>
              <KeyboardAwareScrollView
                style={fullHeight ? styles.body : undefined}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                bottomOffset={theme.spacing.lg}
              >
                {props.children}
              </KeyboardAwareScrollView>
              {props.footer != null ? (
                <View style={styles.footer}>{props.footer}</View>
              ) : null}
            </>
          ) : (
            <View style={styles.actions}>{props.children}</View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SheetHeader(props: {
  readonly title: string;
  readonly closeAccessibilityLabel: string;
  readonly onClose: () => void;
  readonly back?: SheetBack | undefined;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.header}>
      {props.back !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.back.accessibilityLabel}
          onPress={props.back.onPress}
          style={({ pressed }) => [
            styles.close,
            pressed ? styles.pressed : null,
          ]}
        >
          <ChevronLeftIcon
            size={theme.iconSize.sm}
            color={theme.colors.mutedForeground}
          />
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {props.title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.closeAccessibilityLabel}
        onPress={props.onClose}
        style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
      >
        <XIcon size={theme.iconSize.sm} color={theme.colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  host: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayHit: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  panel: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radii.sheet,
    borderTopRightRadius: theme.radii.sheet,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.lg,
  },
  panelMax: {
    maxHeight: "86%",
  },
  panelFull: {
    height: "92%",
    maxHeight: "92%",
  },
  grabber: {
    alignSelf: "center",
    width: theme.spacing["3xl"],
    height: theme.spacing["2xs"] + theme.spacing["2xs"],
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
  },
  close: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  description: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  actions: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.pressedOpacity,
  },
}));
