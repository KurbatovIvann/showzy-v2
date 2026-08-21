/**
 * React Native adapters for TanStack Query. Import from the provider
 * only — not from tests (NetInfo is native).
 */
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

/**
 * NetInfo → `onlineManager`; AppState → `focusManager`. Call once from
 * the query runtime provider. Returns cleanup.
 */
export function setupQueryPlatform(): () => void {
  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    onlineManager.setOnline(state.isConnected === true);
  });

  function onAppStateChange(status: AppStateStatus): void {
    focusManager.setFocused(status === "active");
  }

  const appStateSubscription = AppState.addEventListener(
    "change",
    onAppStateChange,
  );

  return () => {
    netInfoUnsubscribe();
    appStateSubscription.remove();
  };
}
