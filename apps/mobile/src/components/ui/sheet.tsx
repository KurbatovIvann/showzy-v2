import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { XIcon } from "lucide-react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { SHEET_MS, sheetDismissTimeoutMs } from "./sheet-dismiss";

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Canvas sheet: dim overlay (`colors.overlay`) and a bottom card with
 * `radii.sheet`. Confirmation callers keep `children` as actions.
 * Content callers pass `footer` (and optional `fullHeight`) so children
 * become the scrollable body. Host stays mounted; `visible` drives
 * open/close. Drag-to-dismiss is omitted — the close control and Android
 * back (`onRequestClose`) dismiss it.
 */
export function Sheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly description?: string;
  readonly footer?: ReactNode;
  readonly fullHeight?: boolean;
  readonly closeAccessibilityLabel?: string;
  readonly onHidden?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const panelHeight = useSharedValue(0);
  const [presented, setPresented] = useState(false);
  const presentedRef = useRef(false);
  const closeGenerationRef = useRef(0);
  const onHiddenRef = useRef(props.onHidden);
  onHiddenRef.current = props.onHidden;
  const hideModal = useCallback(() => {
    presentedRef.current = false;
    setPresented(false);
  }, []);
  const hideModalIfCurrent = useCallback(
    (generation: number) => {
      if (closeGenerationRef.current !== generation) {
        return;
      }
      hideModal();
    },
    [hideModal],
  );

  useEffect(() => {
    if (props.visible) {
      closeGenerationRef.current += 1;
      presentedRef.current = true;
      setPresented(true);
      if (reduceMotion) {
        progress.set(1);
        return;
      }
      progress.set(
        withTiming(1, {
          duration: SHEET_MS,
          easing: EASE_SHEET,
        }),
      );
      return;
    }
    if (!presentedRef.current) {
      progress.set(0);
      return;
    }
    if (reduceMotion) {
      progress.set(0);
      hideModal();
      return;
    }
    const generation = closeGenerationRef.current;
    progress.set(
      withTiming(
        0,
        {
          duration: SHEET_MS,
          easing: EASE_SHEET,
        },
        () => {
          // Always hide — an interrupted close (`finished === false`)
          // used to leave the iOS Modal window mounted, which eats taps
          // until the app is relaunched. Worklet: do not read React refs.
          scheduleOnRN(hideModalIfCurrent, generation);
        },
      ),
    );
    const timeout = setTimeout(() => {
      hideModalIfCurrent(generation);
    }, sheetDismissTimeoutMs());
    return () => {
      clearTimeout(timeout);
    };
  }, [hideModal, hideModalIfCurrent, progress, props.visible, reduceMotion]);

  const fallbackTravel = theme.hitTarget.field;
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));
  const panelStyle = useAnimatedStyle(() => {
    const measured = panelHeight.get();
    const travel = measured > 0 ? measured : fallbackTravel;
    return {
      transform: [
        {
          translateY: interpolate(progress.get(), [0, 1], [travel, 0]),
        },
      ],
    };
  });
  const description =
    props.description != null && props.description.length > 0
      ? props.description
      : null;
  const closeLabel =
    props.closeAccessibilityLabel != null &&
    props.closeAccessibilityLabel.length > 0
      ? props.closeAccessibilityLabel
      : null;
  const contentMode = props.footer !== undefined;
  const fullHeight = props.fullHeight === true;

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={props.onClose}
      onDismiss={() => {
        onHiddenRef.current?.();
      }}
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
          <Animated.View style={[styles.overlay, overlayStyle]} />
        </Pressable>
        <Animated.View
          accessibilityViewIsModal
          onLayout={(event) => {
            panelHeight.set(event.nativeEvent.layout.height);
          }}
          style={[
            styles.panel,
            fullHeight ? styles.panelFull : styles.panelMax,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
            panelStyle,
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {props.title}
            </Text>
            {closeLabel !== null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                onPress={props.onClose}
                style={({ pressed }) => [
                  styles.close,
                  pressed ? styles.pressed : null,
                ]}
              >
                <XIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.mutedForeground}
                />
              </Pressable>
            ) : null}
          </View>
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
    opacity: 0.85,
  },
}));
