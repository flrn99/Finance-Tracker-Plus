import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/api-config";
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// ── Nav bar color helper — call this anywhere in the app ─────────────────────
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true });

  let savedTheme = "light";
  try { savedTheme = localStorage.getItem("ff-theme") ?? "light"; } catch {}

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (savedTheme === "system" && systemDark);

  const bgColor = isDark ? "#141414" : "#F2F2F2";

  StatusBar.setBackgroundColor({ color: bgColor });
  StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark });

}

createRoot(document.getElementById("root")!).render(<App />);
