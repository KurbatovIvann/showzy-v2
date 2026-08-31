import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { useAuthSession } from "../../auth/session-provider";
import { CenteredSpinner } from "../../components/ui";
import { hierarchicalStackScreenOptions } from "../../navigation/hierarchical-stack-options";

export default function AppLayout() {
  const auth = useAuthSession();
  const { theme } = useUnistyles();

  if (auth.status === "loading") {
    return <CenteredSpinner accessibilityLabel={auth.copy.loading} />;
  }
  if (auth.status !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        ...hierarchicalStackScreenOptions,
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
