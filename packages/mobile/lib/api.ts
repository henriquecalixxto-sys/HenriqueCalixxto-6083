import { hc } from "hono/client";
import Constants from "expo-constants";
import type { AppType } from "@template/web";
import { getToken } from "./auth";

const baseUrl = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;
const client = hc<AppType>(baseUrl!, {
  headers: (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export const api = client.api;

/** Safely read an array field from an API response that may be an error object. */
export function listOf<T = any>(data: unknown, key: string): T[] {
  if (data && typeof data === "object" && key in (data as any)) {
    const v = (data as any)[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}
