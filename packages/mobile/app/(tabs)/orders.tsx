import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listOf } from "../../lib/api";
import { colors, fonts } from "../../lib/theme";

export default function OrdersScreen() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [serviceSlug, setServiceSlug] = useState("");
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: async () => (await api.portal.orders.$get()).json() });
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.services.$get()).json() });
  const orderList = listOf(orders.data, "orders");
  const serviceList = listOf(services.data, "services");

  const create = useMutation({
    mutationFn: async () => (await api.portal.orders.$post({ json: { title, serviceSlug } })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setShowForm(false);
      setTitle("");
      setServiceSlug("");
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Orders</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.newBtnText}>{showForm ? "Cancel" : "New Order"}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Order Title" placeholderTextColor={colors.grayLight} value={title} onChangeText={setTitle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {serviceList.map((s: any) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setServiceSlug(s.slug)}
                  style={[styles.chip, serviceSlug === s.slug && styles.chipActive]}
                >
                  <Text style={[styles.chipText, serviceSlug === s.slug && styles.chipTextActive]}>{s.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.submitBtn} onPress={() => create.mutate()} disabled={!title || !serviceSlug || create.isPending}>
              <Text style={styles.submitBtnText}>{create.isPending ? "Submitting..." : "Submit Order"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          {orderList.map((o: any) => (
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontFamily: fonts.display, fontSize: 24 },
  newBtn: { backgroundColor: colors.black, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { color: colors.white, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  form: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 16, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 14, fontFamily: fonts.body },
  chip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  chipText: { fontSize: 12, color: colors.gray },
  chipTextActive: { color: colors.black },
  submitBtn: { backgroundColor: colors.gold, padding: 14, alignItems: "center" },
  submitBtnText: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: colors.black },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  orderRow: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderTitle: { fontFamily: fonts.display, fontSize: 14 },
  orderSub: { color: colors.gray, fontSize: 12, marginTop: 2 },
  statusPill: { borderWidth: 1, borderColor: colors.gold, color: colors.gold, fontSize: 10, textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 4 },
  empty: { padding: 20, color: colors.gray, textAlign: "center" },
});
