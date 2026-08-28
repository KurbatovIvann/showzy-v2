import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { CompanyResolutionBoundary } from "../../../company-resolution/company-resolution-boundary";
import { hierarchicalStackScreenOptions } from "../../../navigation/hierarchical-stack-options";

/**
 * Price-list stack sits beside the tab shell on the (app) Stack, so it
 * does not inherit the tabs' company-resolution provider. Wrap these
 * routes the same way so `useResolvedCompany` (permission affordances)
 * is defined on the list and editor placeholder.
 */
export default function PriceListsLayout() {
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
