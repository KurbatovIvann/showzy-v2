import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { OtpProvider } from "../../auth/otp/provider";
import { useAuthSession } from "../../auth/session-provider";
import { CenteredSpinner } from "../../components/ui";

export default function AuthLayout() {
  const auth = useAuthSession();
  const { theme } = useUnistyles();

  if (auth.configError) {
    return <Redirect href="/" />;
  }
  if (auth.status === "authenticated") {
    return <Redirect href="/session" />;
  }
  if (auth.authClient === null) {
    if (auth.status === "loading") {
      return <CenteredSpinner accessibilityLabel={auth.copy.loading} />;
    }
    return <Redirect href="/" />;
  }

  return (
    <OtpProvider>
      {auth.status === "loading" ? (
        <CenteredSpinner accessibilityLabel={auth.copy.loading} />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
      )}
    </OtpProvider>
  );
}
