import * as Sentry from '@sentry/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isReportableError, queryClient } from './queryClient'

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

/**
 * Unit tests for `isReportableError`, which drives both Sentry reporting
 * (queryCache/mutationCache `onError`) and the retry policy: a benign,
 * expected auth-missing/expired condition should be neither reported nor
 * retried.
 */
describe('isReportableError', () => {
  it('treats a genuine error as reportable', () => {
    expect(isReportableError(new Error('Unexpected server error'))).toBe(true)
  })

  it('treats a non-Error value as reportable by default', () => {
    expect(isReportableError('some string failure')).toBe(true)
    expect(isReportableError({ code: '42501' })).toBe(true)
  })

  it.each([
    'Not authenticated',
    'Auth session missing',
    'JWT expired',
    'Invalid Refresh Token: Already Used',
    'Refresh Token Not Found',
  ])('treats a benign auth-missing/expired message as NOT reportable: %s', (message) => {
    expect(isReportableError(new Error(message))).toBe(false)
  })

  it('is case-insensitive when matching benign auth patterns', () => {
    expect(isReportableError(new Error('AUTH SESSION MISSING'))).toBe(false)
  })
})

/**
 * The global QueryCache `onError` honours a query's typed
 * `meta.skipErrorReport`, so a feature can keep expected errors (e.g. a
 * third-party outage) out of Sentry without `src/lib` knowing its error types.
 */
describe('queryClient error reporting', () => {
  class OutageError extends Error {}

  /** Runs a query that fails once with `error` (no retries), swallowing the rejection. */
  async function runFailingQuery(
    error: Error,
    meta?: { skipErrorReport?: (error: unknown) => boolean },
  ): Promise<void> {
    await queryClient
      .fetchQuery({
        queryKey: ['query-client-test', Math.random()],
        queryFn: () => Promise.reject(error),
        retry: false,
        meta,
      })
      .catch(() => undefined)
  }

  afterEach(() => {
    vi.mocked(Sentry.captureException).mockClear()
    queryClient.clear()
  })

  it('reports a failing query without meta', async () => {
    const error = new Error('Unexpected server error')
    await runFailingQuery(error)
    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { source: 'query' } })
  })

  it('skips reporting when skipErrorReport returns true for the error', async () => {
    await runFailingQuery(new OutageError('upstream down'), {
      skipErrorReport: (error) => error instanceof OutageError,
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('still reports when skipErrorReport returns false for the error', async () => {
    const error = new Error('schema mismatch')
    await runFailingQuery(error, { skipErrorReport: (caught) => caught instanceof OutageError })
    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { source: 'query' } })
  })

  it('still skips benign auth errors regardless of meta', async () => {
    await runFailingQuery(new Error('Auth session missing'))
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
