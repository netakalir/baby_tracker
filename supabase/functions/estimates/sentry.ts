/**
 * Sentry error monitoring for this Edge Function (Deno).
 *
 * Mirrors the frontend policy (see `src/lib/monitoring.ts`):
 * - Errors only. `tracesSampleRate: 0` — no performance tracing. No PII.
 * - DSN is read from the Deno env (`SENTRY_DSN`); absent → a clean no-op.
 * - Reporting is gated to the `production` and `integration` environments only,
 *   so a local `supabase functions serve` never sends events.
 * - `beforeSend` scrubs PII conservatively before anything leaves the runtime.
 *
 * This file is intentionally self-contained (the functions have no shared dir);
 * the sibling `delete-user` function carries its own copy.
 */

import * as Sentry from 'npm:@sentry/deno@10'

/** Environments allowed to report; anything else keeps monitoring disabled. */
const REPORTING_ENVIRONMENTS = ['production', 'integration']

let initialized = false

/** Marker left in place of a redacted query string or hash fragment. */
const REDACTED = '[redacted]'

/** Breadcrumb `data` keys that hold a URL (fetch/xhr `url`, navigation `from`/`to`). */
const URL_BREADCRUMB_KEYS = ['url', 'to', 'from']

/**
 * Drops the query string and hash fragment from a URL, keeping only the path.
 * The whole query/hash is redacted (never individual params): tokens such as
 * `?token=…`, `#access_token=…` or `?code=…` must never leave the runtime, and
 * error reports never need query strings. Handles absolute and relative URLs.
 */
function redactUrl(url: string): string {
  const separator = url.search(/[?#]/)
  return separator === -1 ? url : `${url.slice(0, separator)}${REDACTED}`
}

/**
 * Strips personally identifying information before an event is sent.
 * Keeps only a non-identifying `user.id` (a UUID) when present; drops emails,
 * usernames, IPs, request cookies and any auth-bearing headers. Also redacts the
 * query string and hash fragment from `request.url`, its split-out
 * `query_string`, and every breadcrumb URL (`data.url`/`to`/`from` plus
 * `http.query`/`http.fragment`) — Sentry's default integrations attach these and
 * they can carry invite/auth tokens. The estimates API receives a `child_id` and
 * the caller's JWT — neither is attached to Sentry scope anywhere, and this hook
 * is the backstop that keeps it that way.
 */
// deno-lint-ignore no-explicit-any
function scrubEvent(event: any): any {
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {}
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
  if (Array.isArray(event.breadcrumbs)) {
    for (const breadcrumb of event.breadcrumbs) {
      const data = breadcrumb?.data
      if (!data) continue
      for (const key of URL_BREADCRUMB_KEYS) {
        if (typeof data[key] === 'string') {
          data[key] = redactUrl(data[key])
        }
      }
      delete data['http.query']
      delete data['http.fragment']
    }
  }
  return event
}

/** Initializes Sentry once. No-ops unless a DSN is set in a reporting env. */
export function initSentry(): void {
  if (initialized) return
  const dsn = Deno.env.get('SENTRY_DSN')
  const environment = Deno.env.get('SENTRY_ENVIRONMENT') ?? 'development'
  if (!dsn || !REPORTING_ENVIRONMENTS.includes(environment)) return

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  })
  initialized = true
}

/**
 * Wraps a request handler so any thrown (uncaught) error is reported to Sentry
 * and then re-thrown unchanged — the runtime's default 500 and the function's
 * existing response/CORS contract are preserved exactly.
 */
export function withSentry(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  initSentry()
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request)
    } catch (error) {
      Sentry.captureException(error)
      // Edge invocations are short-lived; flush so the event is not lost when
      // the isolate is torn down. Bounded so a slow Sentry never stalls a reply.
      await Sentry.flush(2000)
      throw error
    }
  }
}
