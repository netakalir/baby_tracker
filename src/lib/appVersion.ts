/**
 * Typed access to the build-time app version, so components read a single
 * helper instead of scattered `import.meta.env` / global reads. The values are
 * injected by Vite's `define` from package.json's `version` (single source of
 * truth) and, when available, the short git commit SHA.
 */

/** The app version string, e.g. `"0.1.0"`. */
export const appVersion: string = __APP_VERSION__

/** The short git commit SHA of the build, or an empty string when git was unavailable. */
export const appCommitSha: string = __APP_COMMIT_SHA__

/**
 * A short, user-facing version label for the Settings "about" line, e.g.
 * `"גרסה 0.1.0"`. The commit SHA is intentionally omitted here — it is exposed
 * separately via {@link appCommitSha} for bug-report correlation without
 * cluttering the quiet UI line.
 */
export function formatVersionLabel(): string {
  return `גרסה ${appVersion}`
}
