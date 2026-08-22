import "../theme/unistyles";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";

import { ApiProvider } from "../api/api-provider";
import { QueryRuntimeProvider } from "../api/query-provider";
import { SessionProvider } from "../auth/session-provider";

export default function RootLayout() {
  const { theme, rt } = useUnistyles();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  return (
    <SafeAreaProvider>
      <KeyboardProvider
        statusBarTranslucent
        navigationBarTranslucent
        preserveEdgeToEdge
      >
        <SessionProvider>
          <ApiProvider>
            <QueryRuntimeProvider>
              <StatusBar style={rt.themeName === "dark" ? "light" : "dark"} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.background },
                }}
              />
            </QueryRuntimeProvider>
          </ApiProvider>
        </SessionProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
