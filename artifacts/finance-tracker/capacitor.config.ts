import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.florian.financetracker',
  appName: 'Flow Finance',
  webDir: 'dist/public',
  plugins: {
    App: {
      appUrlOpen: true,
    }
  }
};

export default config;