import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api, listOf } from "../../lib/api";
import { authClient } from "../../lib/auth";
import { colors, fonts } from "../../lib/theme";

export default function QuoteScreen() {
  const { data: session } = authClient.useSession();
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.services.$get()).json() });
  const serviceList = listOf(services.data, "services");
  const [serviceSlug, setServiceSlug] = useState("");
  const [details, setDetails] = useState("");

  const submit = useMutation({
    mutationFn: async () =>
      (await api.quotes.$post({
        json: { name: session?.user?.name ?? "", email: session?.user?.email ?? "", serviceSlug, details },
      })).json(),
  });

  if (submit.isSuccess) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.gold} />
          <Text style={styles.successTitle}>Request Received</Text>
          <Text style={styles.successSub}>Our team will follow up with your quote shortly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Request a Quote</Text>
          <Text style={styles.sub}>Tell us about your document needs.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {serviceList.map((s: any) => (
              <TouchableOpacity key={s.id} onPress={() => setServiceSlug(s.slug)} style={[styles.chip, serviceSlug === s.slug && styles.chipActive]}>
                <Text style={[styles.chipText, serviceSlug === s.slug && styles.chipTextActive]}>{s.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.textarea}
            placeholder="Describe your document needs..."
            placeholderTextColor={colors.grayLight}
            multiline
            numberOfLines={6}
            value={details}
            onChangeText={setDetails}
          />

          <TouchableOpacity style={styles.button} onPress={() => submit.mutate()} disabled={!serviceSlug || !details || submit.isPending}>
            <Text style={styles.buttonText}>{submit.isPending ? "Submitting..." : "Submit Request"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { padding: 24, paddingBottom: 60 },
  title: { fontFamily: fonts.display, fontSize: 24, marginBottom: 4 },
  sub: { color: colors.gray, marginBottom: 20 },
  chip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  chipText: { fontSize: 12, color: colors.gray },
  chipTextActive: { color: colors.black },
  textarea: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 14, minHeight: 140, textAlignVertical: "top", marginBottom: 20, fontFamily: fonts.body },
  button: { backgroundColor: colors.gold, padding: 16, alignItems: "center" },
  buttonText: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: colors.black },
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  successTitle: { fontFamily: fonts.display, fontSize: 22, marginTop: 16 },
  successSub: { color: colors.gray, textAlign: "center", marginTop: 8 },
});
