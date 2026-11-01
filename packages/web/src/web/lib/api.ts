import { hc } from "hono/client";
import type { AppType } from "../../api";
import { authClient } from "./auth";

const client = hc<AppType>("/", {
  headers: () => {
    const token = authClient.managedAuth.getToken();
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
