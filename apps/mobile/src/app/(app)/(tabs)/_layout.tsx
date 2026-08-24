import { Tabs } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

import { BottomNav } from "../../../components/screens/panel/bottom-nav";

/**
 * Staff panel tab shell (SHO-122). Nested inside the `(app)` Stack so
 * future detail screens can push over the tabs. Canvas order: orders ·
 * products · ai (center) · customers; `more` lands in ui-shell-T2.
 */
export default function TabsLayout() {
  const { theme } = useUnistyles();

  return (
    <Tabs
      initialRouteName="orders"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="products" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="customers" />
    </Tabs>
  );
}
