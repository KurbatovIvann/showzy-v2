import { Stack } from "expo-router/stack";
import { useUnistyles } from "react-native-unistyles";

import { CompanyResolutionBoundary } from "../../../company-resolution/company-resolution-boundary";

/**
 * Product stack sits beside the tab shell on the (app) Stack, so it
 * does not inherit the tabs' company-resolution provider. Wrap these
 * routes the same way so `useResolvedCompany` (permission affordances)
 * is defined on detail, create/edit, and the photos stub. Nested native
 * Stack keeps detail → edit / photos history (Slot would replace in place).
 */
export default function ProductsLayout() {
  const { theme } = useUnistyles();

  return (
    <CompanyResolutionBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </CompanyResolutionBoundary>
  );
}
