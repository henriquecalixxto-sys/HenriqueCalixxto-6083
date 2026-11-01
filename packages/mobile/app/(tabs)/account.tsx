import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authClient, clearToken } from "../../lib/auth";
import { colors, fonts } from "../../lib/theme";

export default function AccountScreen() {
  const { data: session } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    await clearToken();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.card}>
          <Text style={styles.name}>{session?.user?.name}</Text>
          <Text style={styles.email}>{session?.user?.email}</Text>
        </View>

        <Text style={styles.sectionTitle}>Contact Calixto Agency</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL("tel:+14754494306")}>
            <Ionicons name="call-outline" size={20} color={colors.gold} />
            <Text style={styles.rowText}>(475) 449-4306</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL("mailto:info@calixtoagency.com")}>
            <Ionicons name="mail-outline" size={20} color={colors.gold} />
            <Text style={styles.rowText}>info@calixtoagency.com</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={20} color={colors.gold} />
            <Text style={styles.rowText}>4 Worth Street, Bridgeport, CT 06606</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.white} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Calixto Agency provides document services only and does not provide legal representation or legal advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { padding: 24, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 24, marginBottom: 20 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 18, marginBottom: 24 },
  name: { fontFamily: fonts.display, fontSize: 17 },
  email: { color: colors.gray, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 15, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { color: colors.gray, fontFamily: fonts.body },
  signOutBtn: { flexDirection: "row", gap: 8, backgroundColor: colors.navy, padding: 16, alignItems: "center", justifyContent: "center", marginBottom: 30 },
  signOutText: { color: colors.white, textTransform: "uppercase", fontSize: 12, letterSpacing: 1 },
  disclaimer: { color: colors.grayLight, fontSize: 11, textAlign: "center", lineHeight: 16 },
});
