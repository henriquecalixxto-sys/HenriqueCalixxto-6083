import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { api, listOf } from "../../lib/api";
import { colors, fonts } from "../../lib/theme";

export default function DocumentsScreen() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const documents = useQuery({ queryKey: ["my-documents"], queryFn: async () => (await api.portal.documents.$get()).json() });
  const docList = listOf(documents.data, "documents");

  const remove = useMutation({
    mutationFn: async (id: number) => (await api.portal.documents[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-documents"] }),
  });

  const download = async (id: number) => {
    const res = await api.portal.documents[":id"].url.$get({ param: { id: String(id) } });
    const data = await res.json();
    if ("url" in data) Linking.openURL(data.url);
  };

  const pickAndUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setUploading(true);
    try {
      for (const file of result.assets) {
        const contentType = file.mimeType ?? "application/octet-stream";
        const size = file.size ?? 0;
        const presign = await api.portal.documents.presign.$post({
          json: { filename: file.name, contentType, size },
        });
        const presignBody: any = await presign.json();
        if (!presign.ok || !presignBody?.url) continue;
        const fileRes = await fetch(file.uri);
        const blob = await fileRes.blob();
        const put = await fetch(presignBody.url, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": contentType },
        });
        if (!put.ok) continue;
        await api.portal.documents.$post({
          json: { filename: file.name, key: presignBody.key, contentType, size },
        });
      }
      qc.invalidateQueries({ queryKey: ["my-documents"] });
    } catch (e) {
      Alert.alert("Upload failed", "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Documents</Text>

        <TouchableOpacity style={styles.uploadBox} onPress={pickAndUpload} disabled={uploading}>
          <Ionicons name="cloud-upload-outline" size={30} color={colors.gold} />
          <Text style={styles.uploadTitle}>{uploading ? "Uploading..." : "Tap to Upload Documents"}</Text>
          <Text style={styles.uploadSub}>PDF, JPG, PNG, DOCX — secure & confidential</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {docList.map((d: any) => (
            <View key={d.id} style={styles.row}>
              <Ionicons name="document-text-outline" size={20} color={colors.gold} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.docName}>{d.filename}</Text>
                <Text style={styles.docSub}>{new Date(d.createdAt).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity onPress={() => download(d.id)} style={{ marginRight: 14 }}>
                <Ionicons name="download-outline" size={20} color={colors.gray} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove.mutate(d.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.gray} />
              </TouchableOpacity>
            </View>
          ))}
          {docList.length === 0 && <Text style={styles.empty}>No documents uploaded yet.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { padding: 24, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 24, marginBottom: 20 },
  uploadBox: { borderWidth: 2, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.white, padding: 30, alignItems: "center", marginBottom: 24 },
  uploadTitle: { fontFamily: fonts.display, fontSize: 15, marginTop: 10 },
  uploadSub: { color: colors.gray, fontSize: 12, marginTop: 4, textAlign: "center" },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  docName: { fontSize: 13, fontFamily: fonts.body },
  docSub: { color: colors.gray, fontSize: 11, marginTop: 2 },
  empty: { padding: 20, color: colors.gray, textAlign: "center" },
});
