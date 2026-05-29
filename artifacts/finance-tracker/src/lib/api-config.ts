import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "./supabase";

export function getApiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "");
  if (base) {
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }
  const viteBase = (import.meta.env.BASE_URL as string | undefined) ?? "/";
  return `${viteBase.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl.replace(/\/+$/, ""));
}

setAuthTokenGetter(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});