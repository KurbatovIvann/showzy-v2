import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useUnistyles } from "react-native-unistyles";

import { SHEET_MS } from "./sheet-dismiss";
import {
  nextSheetGeneration,
  sheetClosePlan,
  sheetOpenMotion,
  shouldCommitSheetHide,
  startSheetHideWatchdog,
} from "./sheet-presentation";

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Host stays mounted; `visible` drives open/close. Generation-gated hide
 * plus a watchdog keep the iOS stuck-Modal defense intact when a close
 * animation is interrupted.
 */
export function useSheetPresentation(visible: boolean, onHidden?: () => void) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const panelHeight = useSharedValue(0);
  const [presented, setPresented] = useState(false);
  const presentedRef = useRef(false);
  const closeGenerationRef = useRef(0);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  const hideModal = useCallback(() => {
    presentedRef.current = false;
    setPresented(false);
  }, []);
  const hideModalIfCurrent = useCallback(
    (generation: number) => {
      if (!shouldCommitSheetHide(closeGenerationRef.current, generation)) {
        return;
      }
      hideModal();
    },
    [hideModal],
  );

  useEffect(() => {
    if (visible) {
      closeGenerationRef.current = nextSheetGeneration(
        closeGenerationRef.current,
      );
      presentedRef.current = true;
      setPresented(true);
      if (sheetOpenMotion(reduceMotion) === "snap") {
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
    const plan = sheetClosePlan({
      presented: presentedRef.current,
      reduceMotion,
      generation: closeGenerationRef.current,
    });
    if (plan.kind === "idle") {
      progress.set(0);
      return;
    }
    if (plan.kind === "snap") {
      progress.set(0);
      hideModal();
      return;
    }
    const generation = plan.generation;
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
    return startSheetHideWatchdog({
      generation,
      hideIfCurrent: hideModalIfCurrent,
    });
  }, [hideModal, hideModalIfCurrent, progress, visible, reduceMotion]);

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

  return {
    presented,
    overlayStyle,
    panelStyle,
    onPanelLayout: (event: LayoutChangeEvent) => {
      panelHeight.set(event.nativeEvent.layout.height);
    },
    onModalDismiss: () => {
      onHiddenRef.current?.();
    },
  };
}
