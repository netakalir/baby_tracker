import * as Sentry from '@sentry/react'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

/**
 * Decides whether a failed query/mutation is worth reporting to Sentry. We want
 * genuine failures (network/5xx, RLS denials, unexpected Supabase errors) but
 * NOT expected, benign states that surface as errors — chiefly a missing/expired
 * auth session, which the app handles by redirecting to sign-in. Reporting those
 * would drown real issues in noise. Also used to decide whether a benign
 * auth error is worth retrying (it isn't).
 *
 * Exported for unit testing; not part of the module's public API.
 */
export function isReportableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  // Supabase auth surfaces normal "not signed in" / stale-session conditions as
  // errors; these are part of the expected flow, not failures to investigate.
  const benignPatterns = [
    /not authenticated/i,
    /auth session missing/i,
    /jwt expired/i,
    /invalid refresh token/i,
    /refresh token not found/i,
  ]

  return !benignPatterns.some((pattern) => pattern.test(message))
}

/** Captures a query/mutation failure to Sentry unless it is an expected state. */
function captureQueryError(error: unknown, source: 'query' | 'mutation'): void {
  if (!isReportableError(error)) {
    return
  }
  Sentry.captureException(error, { tags: { source } })
}

export const queryClient = new QueryClient({
  // Global error handling: surface real data-layer failures to Sentry from one
  // place, rather than scattering captureException calls across every hook.
  queryCache: new QueryCache({
    onError: (error) => captureQueryError(error, 'query'),
  }),
  mutationCache: new MutationCache({
    onError: (error) => captureQueryError(error, 'mutation'),
  }),
  defaultOptions: {
    queries: {
      // Retry once, but never for a missing/expired auth session — that state
      // won't resolve itself on retry, and the app already redirects to
      // sign-in for it. Reuses the same benign-error check as Sentry reporting.
      retry: (failureCount, error) => failureCount < 1 && isReportableError(error),
      staleTime: 30_000,
    },
  },
})
