import { describe, expect, it } from 'vitest'
import { isReportableError } from './queryClient'

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
