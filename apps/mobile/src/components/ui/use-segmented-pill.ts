import { useCallback, useEffect, useRef } from "react";
import { type LayoutChangeEvent } from "react-native";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  segmentedPillLayoutMove,
  shouldSnapSegmentedPill,
} from "./segmented-tabs.pill";

/** Recipe: on-screen pill move, ease-in-out, 250ms. */
const PILL_MS = 250;
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export function useSegmentedPill<K extends string>(selected: K) {
  const reduceMotion = useReducedMotion();
  const placed = useRef(false);
  const metrics = useRef<Partial<Record<K, { x: number; width: number }>>>({});
  const translateX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const visible = useSharedValue(0);

  const moveTo = useCallback(
    (key: K, reason: "layout" | "select") => {
      const tab = metrics.current[key];
      if (tab === undefined) {
        return;
      }
      const snap = shouldSnapSegmentedPill({
        placed: placed.current,
        reduceMotion,
        reason,
      });
      if (snap) {
        translateX.set(tab.x);
        pillWidth.set(tab.width);
      } else {
        translateX.set(
          withTiming(tab.x, { duration: PILL_MS, easing: EASE_IN_OUT }),
        );
        pillWidth.set(
          withTiming(tab.width, { duration: PILL_MS, easing: EASE_IN_OUT }),
        );
      }
      placed.current = true;
      visible.set(1);
    },
    [pillWidth, reduceMotion, translateX, visible],
  );

  const onTabLayout = useCallback(
    (key: K, event: LayoutChangeEvent) => {
      const next = {
        x: event.nativeEvent.layout.x,
        width: event.nativeEvent.layout.width,
      };
      const prev = metrics.current[key];
      metrics.current[key] = next;
      const reason = segmentedPillLayoutMove({
        isSelected: key === selected,
        placed: placed.current,
        prev,
        next,
      });
      if (reason !== null) {
        moveTo(key, reason);
      }
    },
    [moveTo, selected],
  );

  useEffect(() => {
    moveTo(selected, "select");
  }, [moveTo, selected]);

  // Absolute childless pill: animating `width` is the measured trade-off
  // (expo-animation exception — out of flow, no sibling Yoga). `scaleX`
  // would smear `radii.full`. Pixel-identical to the canvas sliding pill.
  const pillStyle = useAnimatedStyle(() => ({
    opacity: visible.get(),
    transform: [{ translateX: translateX.get() }],
    width: pillWidth.get(),
  }));

  return { onTabLayout, pillStyle };
}
