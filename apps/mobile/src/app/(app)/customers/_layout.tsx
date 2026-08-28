import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { CompanyResolutionBoundary } from "../../../company-resolution/company-resolution-boundary";
import { hierarchicalStackScreenOptions } from "../../../navigation/hierarchical-stack-options";

/**
 * Customer stack sits beside the tab shell on the (app) Stack, so it
 * does not inherit the tabs' company-resolution provider. Wrap these
 * routes the same way so `useResolvedCompany` (permission affordances)
 * is defined on the editor stubs. Nested native Stack keeps create/edit
 * history (Slot would replace in place).
 */
export default function CustomersLayout() {
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
