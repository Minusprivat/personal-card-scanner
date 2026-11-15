import type { CapacitorConfig } from '@capacitor/cli';

/** Verpackt die Web-App aus `dist/` als Android-App. Gebaut wird sie von GitHub Actions. */
const config: CapacitorConfig = {
  appId: 'io.github.minusprivat.cardscanner',
  appName: 'Card Scanner',
  webDir: 'dist',
  backgroundColor: '#101622',
  plugins: {
    SystemBars: {
      // Helle Symbole in der Statusleiste, passend zum dunklen Hintergrund.
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
