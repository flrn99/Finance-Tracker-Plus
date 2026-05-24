import { setBaseUrl } from "@workspace/api-client-react";

/**
 * Returns the base URL for raw fetch() calls (e.g. the Excel export endpoint).
 *
 * - Replit dev / web preview : BASE_URL is the proxy path prefix (e.g. "/")
 * - Capacitor Android build  : VITE_API_BASE_URL is the deployed API origin
 *                              (e.g. "https://your-app.replit.app")
 */
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
