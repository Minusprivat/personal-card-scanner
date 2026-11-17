/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages liefert die App unter /personal-card-scanner/ aus; lokal unter /.
const base = process.env.BASE_PATH ?? '/';

// Versionsnummer für Anzeige und Update-Hinweis; GitHub Actions setzt APP_VERSION.
process.env.VITE_APP_VERSION = process.env.APP_VERSION ?? 'dev';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Personal Card Scanner',
        short_name: 'Card Scanner',
        description: 'Private Riftbound-Sammlung mit Kartenscanner',
        lang: 'de',
        display: 'standalone',
        orientation: 'any',
        background_color: '#101622',
        theme_color: '#101622',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Die Erkennung (OpenCV, rund 13 MB) wird erst beim Öffnen des Scanners geladen
        // und dann für den Betrieb ohne Netz aufgehoben, statt bei jeder Installation.
        globIgnores: ['**/worker-*.js', 'ocr/**'],
        runtimeCaching: [
          {
            // Katalog und Preise: sofort aus dem Speicher, im Hintergrund auffrischen.
            // Die Versionsdatei bleibt außen vor: Die Update-Prüfung braucht den Stand des Servers.
            urlPattern: ({ url }) => url.pathname.includes('/data/') && !url.pathname.endsWith('/version.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tagesdaten' },
          },
          {
            urlPattern: ({ url }) => /\/assets\/worker-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'erkennung' },
          },
          {
            // Texterkennung für die Kartennummer (rund 7 MB), ebenfalls erst bei Bedarf.
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'texterkennung' },
          },
          // Kartenbilder laufen bewusst nicht über den Service Worker: OpenRift liefert sie
          // ohne CORS-Freigabe, aber mit einem Jahr Cache-Dauer. Der Browser-Cache hält
          // bereits gesehene Bilder damit auch ohne Netz vor.
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
