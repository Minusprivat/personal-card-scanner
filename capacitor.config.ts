import type { CapacitorConfig } from '@capacitor/cli';

/** Verpackt die Web-App aus `dist/` als Android-App. Gebaut wird sie von GitHub Actions. */
const config: CapacitorConfig = {
  appId: 'io.github.minusprivat.cardscanner',
  appName: 'Card Scanner',
  webDir: 'dist',
  backgroundColor: '#101622',
  plugins: {
    CapacitorUpdater: {
      // Handbetrieb: Die App entscheidet selbst, wann sie welches Paket lädt (src/app/updater.ts).
      // Der Baustein fragt von sich aus keinen Server und meldet nichts nach außen.
      autoUpdate: false,
      statsUrl: '',
    },
    SystemBars: {
      // Helle Symbole in der Statusleiste, passend zum dunklen Hintergrund.
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
