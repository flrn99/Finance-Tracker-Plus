import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.florian.financetracker',
  appName: 'Flow!',
  webDir: 'dist/public',
  android: {
    captureInput: false,
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    App: {
      appUrlOpen: true,
    }
  }
};

export default config;