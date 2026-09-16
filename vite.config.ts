import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, type PluginOption } from 'vite'
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

const commitSha = resolveCommitSha()

// The Sentry release identifier, kept in sync with `monitoringRelease` in
// `src/lib/monitoring.ts` so uploaded source maps match reported events.
const sentryRelease = commitSha ? `${appVersion}+${commitSha}` : appVersion

// Whether this build uploads source maps to Sentry — true only when a Sentry
// auth token is present in the build env. Drives both the plugin and whether we
// emit source maps at all (see `build.sourcemap` below), so a build without the
// token behaves exactly as before this integration.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN)

// Source-map upload plugin, activated ONLY when a Sentry auth token is present
// in the build env. With no token the build proceeds unchanged (no plugin, no
// error) — dev builds and contributors without Sentry access are unaffected.
// The token/org/project are read from the environment and never logged.
function sentrySourceMapsPlugin(): PluginOption {
  if (!uploadSourceMaps) {
    return undefined
  }
  return sentryVitePlugin({
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Token is read from SENTRY_AUTH_TOKEN by the plugin; not passed explicitly.
    release: { name: sentryRelease },
    // Delete the emitted `.map` files from `dist` after they are uploaded, so
    // they reach Sentry but are never served publicly from production.
    sourcemaps: { filesToDeleteAfterUpload: ['**/*.map'] },
  })
}

// https://vite.dev/config/
export default defineConfig({
  // Emit source maps ONLY when they will be uploaded to Sentry, and as `hidden`
  // so no `//# sourceMappingURL` comment points at them. Combined with the
  // plugin's post-upload deletion, maps reach Sentry (for symbolicated stack
  // traces) but are never emitted or served publicly otherwise — a build with
  // no Sentry auth token produces no maps at all, exactly as before.
  build: {
    sourcemap: uploadSourceMaps ? 'hidden' : false,
  },
  // Compile-time constants read through `src/lib/appVersion.ts` (not scattered
  // `import.meta.env` reads). Stringified so they inline as string literals.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT_SHA__: JSON.stringify(commitSha),
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
    // Must come last so it sees the final built assets. Falsy when no auth token
    // is set, in which case Vite simply ignores it.
    sentrySourceMapsPlugin(),
  ],
  // Honor a port assigned via the PORT env var (used by the preview harness's
  // autoPort); fall back to Vite's default when it isn't set.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
})
