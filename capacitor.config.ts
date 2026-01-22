import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arivuaitech.invoiceintel',
  appName: 'Invoice Intel',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
