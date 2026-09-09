/**
 * Sentry error monitoring for the frontend.
 *
 * This module is the single place that reads Sentry-related build/runtime env
 * (mirroring how `appVersion.ts` centralizes build-time constants) so the rest
 * of the app never touches `import.meta.env` for monitoring config.
 *
 * Deliberate scope (see issue #20):
 * - Errors only. NO Session Replay, NO performance tracing (`tracesSampleRate`
 *   omitted → tracing disabled). The UI is full of baby names, so we never turn
 *   on anything that samples user sessions or navigation.
 * - DSN is env-driven. With no DSN, `initMonitoring()` is a clean no-op and the
 *   app runs normally with monitoring simply off (true in dev and test too).
 * - Reporting is gated to the `production` and `integration` environments only,
 *   so local dev and test never send events even if a DSN leaks into that env.
 * - PII is scrubbed aggressively in `beforeSend` (see below).
 */

import * as Sentry from '@sentry/react'
import { appCommitSha, appVersion } from './appVersion'

/**
 * Environments that are allowed to report to Sentry. Anything else (local dev,
 * test, an unset value) keeps monitoring disabled even when a DSN is present.
 */
const REPORTING_ENVIRONMENTS = ['production', 'integration'] as const

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
const environment = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? 'development'

/**
 * The Sentry release identifier, correlating an event with a specific build.
 * Combines the app version with the short commit SHA when git was available at
 * build time. Kept in sync with the `release` passed to `@sentry/vite-plugin`
 * in `vite.config.ts` so uploaded source maps match reported events.
 */
export const monitoringRelease: string = appCommitSha
  ? `${appVersion}+${appCommitSha}`
  : appVersion

/** Whether this build/environment is allowed to send events. */
function isReportingEnabled(): boolean {
  return (
    Boolean(dsn) &&
    (REPORTING_ENVIRONMENTS as readonly string[]).includes(environment)
  )
}

/** Marker left in place of a redacted query string or hash fragment. */
const REDACTED = '[redacted]'

/**
 * Breadcrumb `data` keys that hold a URL. Sentry's fetch/xhr breadcrumbs use
 * `url`; navigation breadcrumbs use `from`/`to`. Any of these can carry an
 * invite token (`?token=…`) or a Supabase auth token (`#access_token=…`).
 */
const URL_BREADCRUMB_KEYS = ['url', 'to', 'from'] as const

/**
 * Drops the query string and hash fragment from a URL, keeping only the path.
 *
 * We redact the WHOLE query/hash rather than individual params: the app never
 * needs query strings in an error report, and the sensitive values here —
 * invite tokens (`/rest/v1/family_invites?token=eq.<uuid>`, `/join?token=…`)
 * and Supabase magic-link/`detectSessionInUrl` tokens (`#access_token=…`,
 * `#refresh_token=…`, `?code=…`) — must never leave the browser. Works for both
 * absolute and relative URLs by cutting at the first `?` or `#`.
 */
function redactUrl(url: string): string {
  const separator = url.search(/[?#]/)
  return separator === -1 ? url : `${url.slice(0, separator)}${REDACTED}`
}

/**
 * Scrubs URL-bearing fields from a breadcrumb's `data` in place: redacts known
 * URL keys and removes the split-out query/fragment fields that fetch/xhr
 * breadcrumbs attach.
 */
function scrubBreadcrumbData(data: Record<string, unknown>): void {
  for (const key of URL_BREADCRUMB_KEYS) {
    const value = data[key]
    if (typeof value === 'string') {
      data[key] = redactUrl(value)
    }
  }
  delete data['http.query']
  delete data['http.fragment']
}

/**
 * Strips personally identifying information before an event leaves the browser.
 *
 * What we KEEP: the auth user id (an opaque UUID) when Sentry already has it —
 * it is non-identifying on its own and is the only key we need to correlate a
 * user's error reports.
 *
 * What we DROP (conservative — when unsure, remove):
 * - `user.email`, `user.username`, `user.ip_address` — directly identifying.
 * - request cookies and any auth-bearing headers — tokens must never leave.
 * - the query string and hash fragment of `event.request.url`, its split-out
 *   `query_string`, and the same on every breadcrumb URL (`data.url`/`to`/`from`
 *   plus `http.query`/`http.fragment`) — Sentry's default integrations attach
 *   these, and the join flow and magic-link sign-in carry invite/auth tokens in
 *   exactly those places. Without this they would ride into Sentry unredacted.
 * - Baby/child names and event metadata are never intentionally attached to
 *   Sentry scope anywhere in the app; this hook is the backstop that keeps it
 *   that way if a future breadcrumb/context accidentally carries them.
 *
 * Exported for unit testing; not part of the module's public API.
 */
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.user) {
    const { id } = event.user
    event.user = id ? { id } : {}
  }

  if (event.request) {
    delete event.request.cookies
    delete event.request.query_string
    if (typeof event.request.url === 'string') {
      event.request.url = redactUrl(event.request.url)
    }
    if (event.request.headers) {
      for (const header of Object.keys(event.request.headers)) {
        const name = header.toLowerCase()
        if (name === 'authorization' || name === 'cookie' || name === 'apikey') {
          delete event.request.headers[header]
        }
      }
    }
  }

  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (breadcrumb.data) {
        scrubBreadcrumbData(breadcrumb.data)
      }
    }
  }

  return event
}

/**
 * Initializes Sentry. Safe to call unconditionally and exactly once, before the
 * app renders. No-ops (no network, no side effects) unless a DSN is configured
 * AND the environment is one we report from.
 */
export function initMonitoring(): void {
  if (!isReportingEnabled()) {
    return
  }

  Sentry.init({
    dsn,
    environment,
    release: monitoringRelease,
    // Errors only: no tracing (omit `tracesSampleRate`) and no Session Replay.
    // Do not add integrations that sample sessions or navigation — PII safety.
    sendDefaultPii: false,
    beforeSend: (event) => scrubEvent(event),
  })
}
