import "../theme/unistyles";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiProvider } from "../api/api-provider";
import { QueryRuntimeProvider } from "../api/query-provider";
import { SessionProvider } from "../auth/session-provider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <SessionProvider>
          <ApiProvider>
            <QueryRuntimeProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
            </QueryRuntimeProvider>
          </ApiProvider>
        </SessionProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
