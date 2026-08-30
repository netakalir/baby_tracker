import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Single source of truth for the app version: the `version` field in
// package.json. Injected at build time (see `define` below) so the frontend
// never hardcodes a version string.
const packageJsonPath = fileURLToPath(new URL('./package.json', import.meta.url))
const { version: appVersion } = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
  version: string
}

// Optional short commit SHA to correlate a running build with a commit. Git may
// be unavailable (e.g. a source tarball or CI without history) — fall back to an
// empty string rather than failing the build.
function resolveCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Compile-time constants read through `src/lib/appVersion.ts` (not scattered
  // `import.meta.env` reads). Stringified so they inline as string literals.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
  },
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
