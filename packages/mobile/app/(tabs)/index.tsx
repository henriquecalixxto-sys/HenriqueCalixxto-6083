import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api, listOf } from "../../lib/api";
import { authClient } from "../../lib/auth";
import { colors, fonts } from "../../lib/theme";

export default function DashboardScreen() {
  const { data: session } = authClient.useSession();
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: async () => (await api.portal.orders.$get()).json() });
  const documents = useQuery({ queryKey: ["my-documents"], queryFn: async () => (await api.portal.documents.$get()).json() });
  const orderList = listOf(orders.data, "orders");
  const docList = listOf(documents.data, "documents");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Image source={require("../../assets/icon.png")} style={styles.logo} />
          <Text style={styles.brand}>CALIXTO AGENCY</Text>
        </View>

        <Text style={styles.welcome}>Welcome, {session?.user?.name?.split(" ")[0] ?? "Client"}</Text>
        <Text style={styles.sub}>Here's an overview of your account.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="list-outline" size={24} color={colors.gold} />
            <Text style={styles.statNum}>{orderList.length}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-attach-outline" size={24} color={colors.gold} />
            <Text style={styles.statNum}>{docList.length}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <View style={styles.card}>
          {orderList.slice(0, 5).map((o: any) => (
            <View key={o.id} style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>{o.title}</Text>
                <Text style={styles.orderSub}>{o.serviceSlug}</Text>
              </View>
              <Text style={styles.statusPill}>{o.status.replace("_", " ")}</Text>
            </View>
          ))}
          {orderList.length === 0 && <Text style={styles.empty}>No orders yet.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 },
  logo: { width: 28, height: 28 },
  brand: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.5, color: colors.black },
  welcome: { fontFamily: fonts.display, fontSize: 26, color: colors.black, marginBottom: 4 },
  sub: { color: colors.gray, fontFamily: fonts.body, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 30 },
  statCard: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 18 },
  statNum: { fontFamily: fonts.display, fontSize: 26, marginTop: 8 },
  statLabel: { color: colors.gray, fontSize: 12, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  orderRow: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderTitle: { fontFamily: fonts.display, fontSize: 14 },
  orderSub: { color: colors.gray, fontSize: 12, marginTop: 2 },
  statusPill: { borderWidth: 1, borderColor: colors.gold, color: colors.gold, fontSize: 10, textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 4 },
  empty: { padding: 20, color: colors.gray, textAlign: "center" },
});
