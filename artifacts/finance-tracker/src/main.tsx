import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/api-config";
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true });

  // Lee el theme guardado para evitar flash al arrancar
  let savedTheme = "light";
  try { savedTheme = localStorage.getItem("ff-theme") ?? "light"; } catch {}

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (savedTheme === "system" && systemDark);

  StatusBar.setBackgroundColor({ color: isDark ? "#141414" : "#F5F0E8" });
  StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark });
}

createRoot(document.getElementById("root")!).render(<App />);