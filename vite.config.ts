import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Auto-inject the service-worker registration; no manual code in app source.
      injectRegister: 'auto',
      // Keep the SW out of the dev server so it never interferes with HMR.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // App-shell precache only. Offline sync is deliberately out of scope
      // (see CLAUDE.md: offline mode with local caching is deferred).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SPA fallback so an installed launch resolves to the app shell.
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'מעקב תינוק',
        short_name: 'מעקב תינוק',
        description: 'מעקב יומיומי אחר שינה, האכלה, חיתולים ומצב רוח של התינוק',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Design-system tokens: brand indigo-violet + warm-neutral background.
        theme_color: '#5b5bd6',
        background_color: '#fafaf9',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // Honor a port assigned via the PORT env var (used by the preview harness's
  // autoPort); fall back to Vite's default when it isn't set.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
})
