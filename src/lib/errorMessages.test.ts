import { describe, expect, it } from 'vitest'
import { toFriendlyAuthErrorMessage, toFriendlyDbErrorMessage } from './errorMessages'

const GENERIC_MESSAGE = 'משהו השתבש. נסה שוב בעוד רגע.'
const NETWORK_MESSAGE = 'אין חיבור לאינטרנט כרגע. נסה שוב כשהחיבור יחזור.'
const PERMISSION_MESSAGE = 'אין לך הרשאה לבצע פעולה זו.'

describe('toFriendlyAuthErrorMessage', () => {
  it('maps a known auth error code to its Hebrew message', () => {
    expect(toFriendlyAuthErrorMessage({ code: 'invalid_credentials' })).toBe(
      'אימייל או סיסמה לא נכונים.',
    )
  })

  it('maps every documented auth code to a non-empty Hebrew message', () => {
    const codes = [
      'invalid_credentials',
      'user_already_exists',
      'email_exists',
      'email_not_confirmed',
      'weak_password',
      'same_password',
      'over_email_send_rate_limit',
      'over_request_rate_limit',
    ]
    for (const code of codes) {
      expect(toFriendlyAuthErrorMessage({ code })).not.toBe(GENERIC_MESSAGE)
    }
  })

  it('falls back to the generic message for an unknown code', () => {
    expect(toFriendlyAuthErrorMessage({ code: 'some_unmapped_code' })).toBe(GENERIC_MESSAGE)
  })

  it('falls back to the generic message when there is no code at all', () => {
    expect(toFriendlyAuthErrorMessage(new Error('boom'))).toBe(GENERIC_MESSAGE)
    expect(toFriendlyAuthErrorMessage(undefined)).toBe(GENERIC_MESSAGE)
    expect(toFriendlyAuthErrorMessage('a plain string')).toBe(GENERIC_MESSAGE)
  })

  it('recognizes a fetch TypeError as a network error', () => {
    expect(toFriendlyAuthErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_MESSAGE)
  })
})

describe('toFriendlyDbErrorMessage', () => {
  it('maps a unique-violation (23505) to a clear, plain message', () => {
    expect(toFriendlyDbErrorMessage({ code: '23505' })).toBe('הפעולה כבר בוצעה קודם.')
  })

  it('maps an RLS/permission-denied error (42501) to the permission message', () => {
    expect(toFriendlyDbErrorMessage({ code: '42501' })).toBe(PERMISSION_MESSAGE)
  })

  it('falls back to the generic message for an unmapped Postgres code', () => {
    expect(toFriendlyDbErrorMessage({ code: '99999' })).toBe(GENERIC_MESSAGE)
  })

  it('recognizes a fetch TypeError as a network error', () => {
    expect(toFriendlyDbErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_MESSAGE)
  })

  it('never leaks a raw error message or stack to the user', () => {
    const raw = new Error('duplicate key value violates unique constraint "events_pkey"')
    const message = toFriendlyDbErrorMessage(raw)
    expect(message).toBe(GENERIC_MESSAGE)
    expect(message).not.toContain('constraint')
    expect(message).not.toContain('events_pkey')
  })
})
