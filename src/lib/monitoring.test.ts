import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import { scrubEvent } from './monitoring.ts'

/**
 * Unit tests for `scrubEvent`, the `beforeSend` PII backstop. The module's
 * stated guarantee is that identifying data and tokens never leave the browser,
 * so these tests assert on the four surfaces Sentry's default integrations can
 * populate: `user`, request headers, `request.url`, and breadcrumb URLs.
 */
describe('scrubEvent', () => {
  it('keeps only the opaque user id and drops identifying user fields', () => {
    const event = scrubEvent({
      user: {
        id: 'user-uuid-123',
        email: 'parent@example.com',
        username: 'parent',
        ip_address: '203.0.113.7',
      },
    } as ErrorEvent)

    expect(event.user).toEqual({ id: 'user-uuid-123' })
  })

  it('empties the user object when there is no id to keep', () => {
    const event = scrubEvent({
      user: { email: 'parent@example.com' },
    } as ErrorEvent)

    expect(event.user).toEqual({})
  })

  it('drops cookies and auth-bearing headers, case-insensitively', () => {
    const event = scrubEvent({
      request: {
        cookies: { session: 'secret' },
        headers: {
          Authorization: 'Bearer token-abc',
          Cookie: 'sb-access-token=abc',
          apikey: 'anon-key',
          'Content-Type': 'application/json',
        },
      },
    } as unknown as ErrorEvent)

    expect(event.request?.cookies).toBeUndefined()
    expect(event.request?.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('redacts the query string of request.url (invite token flow)', () => {
    const event = scrubEvent({
      request: {
        url: 'https://app.example.com/rest/v1/family_invites?token=eq.abc-123',
      },
    } as unknown as ErrorEvent)

    expect(event.request?.url).toBe('https://app.example.com/rest/v1/family_invites[redacted]')
    expect(event.request?.url).not.toContain('abc-123')
    expect(event.request?.url).not.toContain('token')
  })

  it('redacts the hash fragment of request.url (magic-link auth token)', () => {
    const event = scrubEvent({
      request: {
        url: 'https://app.example.com/#access_token=xyz&refresh_token=rrr',
        query_string: 'token=leak',
      },
    } as unknown as ErrorEvent)

    expect(event.request?.url).toBe('https://app.example.com/[redacted]')
    expect(event.request?.url).not.toContain('access_token')
    expect(event.request?.url).not.toContain('xyz')
    expect(event.request?.query_string).toBeUndefined()
  })

  it('leaves a url without a query or hash untouched', () => {
    const event = scrubEvent({
      request: { url: 'https://app.example.com/today' },
    } as unknown as ErrorEvent)

    expect(event.request?.url).toBe('https://app.example.com/today')
  })

  it('redacts urls and query fields carried by breadcrumbs', () => {
    const event = scrubEvent({
      breadcrumbs: [
        {
          category: 'fetch',
          data: {
            url: '/rest/v1/family_invites?token=eq.secret',
            'http.query': 'token=eq.secret',
            'http.fragment': 'access_token=leak',
            status_code: 500,
          },
        },
        {
          category: 'navigation',
          data: {
            from: '/join?token=invite-secret',
            to: '/today#access_token=auth-secret',
          },
        },
        { category: 'ui.click', message: 'button' },
      ],
    } as unknown as ErrorEvent)

    const [fetchCrumb, navCrumb, uiCrumb] = event.breadcrumbs ?? []

    expect(fetchCrumb.data?.url).toBe('/rest/v1/family_invites[redacted]')
    expect(fetchCrumb.data?.['http.query']).toBeUndefined()
    expect(fetchCrumb.data?.['http.fragment']).toBeUndefined()
    expect(fetchCrumb.data?.status_code).toBe(500)

    expect(navCrumb.data?.from).toBe('/join[redacted]')
    expect(navCrumb.data?.to).toBe('/today[redacted]')

    // A breadcrumb with no data is left alone.
    expect(uiCrumb.data).toBeUndefined()

    const serialized = JSON.stringify(event)
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('auth-secret')
  })

  it('returns an event with nothing sensitive to scrub unchanged in shape', () => {
    const event = scrubEvent({ message: 'boom' } as ErrorEvent)
    expect(event.message).toBe('boom')
  })
})
