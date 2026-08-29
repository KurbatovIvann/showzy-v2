import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { CompanyResolutionBoundary } from "../../../company-resolution/company-resolution-boundary";
import { hierarchicalStackScreenOptions } from "../../../navigation/hierarchical-stack-options";

/**
 * Order stack sits beside the tab shell on the (app) Stack, so it
 * does not inherit the tabs' company-resolution provider. Wrap these
 * routes the same way so `useResolvedCompany` (permission affordances)
 * is defined on detail. Nested native Stack keeps list → detail
 * history (Slot would replace in place).
 */
export default function OrdersLayout() {
  const { theme } = useUnistyles();

  return (
    <CompanyResolutionBoundary>
      <Stack
        screenOptions={{
          ...hierarchicalStackScreenOptions,
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </CompanyResolutionBoundary>
  );
}
