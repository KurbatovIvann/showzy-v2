import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";

/**
 * V1 native-stack push: full-screen iOS swipe-back with a right-slide.
 * Spread onto hierarchical stacks only — not auth, root, or tabs.
 */
export const hierarchicalStackScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animation: "slide_from_right",
  animationMatchesGesture: true,
} as const satisfies NativeStackNavigationOptions;
