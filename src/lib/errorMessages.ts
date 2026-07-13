/**
 * Maps Supabase/Postgres errors to plain Hebrew, user-facing messages.
 * Per error-handling-spec.md: never show a raw error/stack trace to the user.
 */

const GENERIC_MESSAGE = 'משהו השתבש. נסה שוב בעוד רגע.'
const NETWORK_MESSAGE = 'אין חיבור לאינטרנט כרגע. נסה שוב כשהחיבור יחזור.'
const PERMISSION_MESSAGE = 'אין לך הרשאה לבצע פעולה זו.'

const AUTH_CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'אימייל או סיסמה לא נכונים.',
  user_already_exists: 'כבר קיים חשבון עם האימייל הזה. נסה להתחבר במקום.',
  email_exists: 'כבר קיים חשבון עם האימייל הזה. נסה להתחבר במקום.',
  email_not_confirmed: 'צריך לאשר את כתובת האימייל לפני ההתחברות.',
  weak_password: 'הסיסמה חייבת להכיל לפחות 6 תווים.',
  same_password: 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית.',
  over_email_send_rate_limit: 'נשלחו יותר מדי בקשות. נסה שוב בעוד כמה דקות.',
  over_request_rate_limit: 'נשלחו יותר מדי בקשות. נסה שוב בעוד כמה דקות.',
}

const DB_CODE_MESSAGES: Record<string, string> = {
  '23505': 'הפעולה כבר בוצעה קודם.',
  '42501': PERMISSION_MESSAGE,
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch/i.test(error.message)
}

function hasStringProp<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof (value as Record<K, unknown>)[key] === 'string'
  )
}

export function toFriendlyAuthErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE
  if (hasStringProp(error, 'code') && AUTH_CODE_MESSAGES[error.code]) {
    return AUTH_CODE_MESSAGES[error.code]
  }
  return GENERIC_MESSAGE
}

export function toFriendlyDbErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE
  if (hasStringProp(error, 'code') && DB_CODE_MESSAGES[error.code]) {
    return DB_CODE_MESSAGES[error.code]
  }
  return GENERIC_MESSAGE
}
