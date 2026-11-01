import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.grayLight,
        tabBarStyle: { backgroundColor: colors.navy, borderTopWidth: 0 },
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: "Documents", tabBarIcon: ({ color, size }) => <Ionicons name="document-attach-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="quote" options={{ title: "Get Quote", tabBarIcon: ({ color, size }) => <Ionicons name="pricetag-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
