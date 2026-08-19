import "../theme/unistyles";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthSessionProvider } from "../auth/AuthSession";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthSessionProvider>
    </SafeAreaProvider>
  );
}
