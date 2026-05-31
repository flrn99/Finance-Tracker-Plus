import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/api-config";
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
    StatusBar.setOverlaysWebView({ overlay: true });
  StatusBar.setBackgroundColor({ color: '#F5F0E8' }); // light mode
}

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

const updateStatusBar = (dark: boolean) => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: dark ? '#141414' : '#F5F0E8' });
      StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
    }
};

createRoot(document.getElementById("root")!).render(<App />);