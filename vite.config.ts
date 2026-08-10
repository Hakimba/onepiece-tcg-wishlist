import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/onepiece-tcg-wishlist/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'OP Wishlist',
        short_name: 'OP Wishlist',
        description: 'Wishlist de cartes One Piece TCG',
        theme_color: '#121220',
        background_color: '#121220',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Le defaut ne couvre pas .json, donc les index cartes n'etaient jamais
        // precaches : hors ligne, chaque fetch echouait et l'app retombait sur
        // un index vide (import par serie vide, images SP non resolues).
        // Ils sont charges a chaque demarrage, pas seulement a l'import.
        globPatterns: ['**/*.{js,css,html,ico,png,webmanifest,json}'],
        // Les donnees changent toutes les semaines : sans ca, chaque revision de
        // variants-index.json (~450 Ko) s'empilerait dans le cache.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/static\.dotgg\.gg\/onepiece\/card\/.+\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
})
