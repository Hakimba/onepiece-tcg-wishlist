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
