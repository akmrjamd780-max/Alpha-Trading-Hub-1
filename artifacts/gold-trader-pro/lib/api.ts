import { Platform } from "react-native";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

export const API_BASE = getBaseUrl();

export async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} on ${path}`);
  }
  return (await r.json()) as T;
}
