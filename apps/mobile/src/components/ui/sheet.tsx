import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, Pressable, Text, View } from "react-native";
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

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
const SHEET_MS = 300;

/**
 * Canvas confirmation sheet: dim overlay (`colors.overlay`) and a
 * bottom card with `radii.sheet`. First shared use is product
 * archive/restore (SHO-138). Not a dropdown. Open/close is opacity +
 * translateY (no layout animation). Keep the host mounted and drive
 * `visible`; the Modal stays up until the close timing finishes.
 * Drag-to-dismiss is omitted — the cancel control and Android back
 * (`onRequestClose`) dismiss it.
 */
export function Sheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly description: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const panelHeight = useSharedValue(0);
  const [presented, setPresented] = useState(false);
  const presentedRef = useRef(false);
  const closeGenerationRef = useRef(0);
  const hideModal = useCallback(() => {
    presentedRef.current = false;
    setPresented(false);
  }, []);

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
        (finished) => {
          if (finished && closeGenerationRef.current === generation) {
            scheduleOnRN(hideModal);
          }
        },
      ),
    );
  }, [hideModal, progress, props.visible, reduceMotion]);

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

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      <View style={styles.host} pointerEvents="box-none">
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
            { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
            panelStyle,
          ]}
        >
          <View style={styles.grabber} />
          <Text accessibilityRole="header" style={styles.title}>
            {props.title}
          </Text>
          <Text style={styles.description}>{props.description}</Text>
          <View style={styles.actions}>{props.children}</View>
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
  grabber: {
    alignSelf: "center",
    width: theme.spacing["3xl"],
    height: theme.spacing["2xs"] + theme.spacing["2xs"],
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
  },
  description: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  actions: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
}));
