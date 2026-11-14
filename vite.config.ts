/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages liefert die App unter /personal-card-scanner/ aus; lokal unter /.
const base = process.env.BASE_PATH ?? '/';

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
        runtimeCaching: [
          {
            // Katalog und Preise: sofort aus dem Speicher, im Hintergrund auffrischen.
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tagesdaten' },
          },
          // Kartenbilder laufen bewusst nicht über den Service Worker: OpenRift liefert sie
          // ohne CORS-Freigabe, aber mit einem Jahr Cache-Dauer. Der Browser-Cache hält
          // bereits gesehene Bilder damit auch ohne Netz vor.
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
