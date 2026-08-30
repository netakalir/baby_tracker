/**
 * Compile-time constants injected by Vite's `define` (see `vite.config.ts`).
 * Read them only through `src/lib/appVersion.ts`, never directly.
 */

/** The app version, sourced from the `version` field in package.json. */
declare const __APP_VERSION__: string

/** The short git commit SHA of the build, or an empty string when git is unavailable. */
declare const __APP_COMMIT_SHA__: string
