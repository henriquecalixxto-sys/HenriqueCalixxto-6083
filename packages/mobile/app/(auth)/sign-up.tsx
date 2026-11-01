import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient, captureToken } from "../../lib/auth";
import { colors, fonts } from "../../lib/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    const { error } = await authClient.signUp.email(
      { email, password, name },
      { onSuccess: captureToken },
    );
    setLoading(false);
    if (error) setError(error.message ?? "Sign up failed.");
    else router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Image source={require("../../assets/icon.png")} style={styles.logo} />
          <Text style={styles.eyebrow}>CLIENT PORTAL</Text>
          <Text style={styles.title}>Create Account</Text>

          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={colors.grayLight} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.grayLight} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.grayLight} secureTextEntry value={password} onChangeText={setPassword} />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Creating Account..." : "Create Account"}</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in">
              <Text style={styles.link}>Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flexGrow: 1, justifyContent: "center", padding: 28 },
  logo: { width: 56, height: 56, alignSelf: "center", marginBottom: 16 },
  eyebrow: { color: colors.gold, textAlign: "center", letterSpacing: 3, fontSize: 11, marginBottom: 8 },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: "center", color: colors.black, marginBottom: 32 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 14, marginBottom: 14, fontFamily: fonts.body },
  button: { backgroundColor: colors.black, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: colors.white, letterSpacing: 1.5, fontSize: 12, textTransform: "uppercase" },
  error: { color: "#c0392b", marginBottom: 10, fontSize: 13 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: colors.gray, fontFamily: fonts.body },
  link: { color: colors.gold, textDecorationLine: "underline" },
});
