import "../theme/unistyles";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryRuntimeProvider } from "../api/query-provider";
import { AuthSessionProvider } from "../auth/session-provider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AuthSessionProvider>
          <QueryRuntimeProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryRuntimeProvider>
        </AuthSessionProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
