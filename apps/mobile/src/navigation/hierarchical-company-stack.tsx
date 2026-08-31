import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { CompanyResolutionBoundary } from "../company-resolution/company-resolution-boundary";
import { hierarchicalStackScreenOptions } from "./hierarchical-stack-options";

/**
 * Company-scoped hierarchical stack. These routes sit beside the tab
 * shell on the (app) Stack, so they do not inherit the tabs'
 * company-resolution provider. Wrap them the same way so
 * `useResolvedCompany` is defined on pushed screens. Nested native
 * Stack keeps history (Slot would replace in place).
 */
export function HierarchicalCompanyStack() {
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
