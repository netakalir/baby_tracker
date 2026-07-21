/**
 * The email a user just signed up / tried to sign in with, while unconfirmed.
 * Supabase does not return a session for an unconfirmed user, so the
 * "check your email" screen can't rely on an authenticated user object -
 * this is a short-lived, tab-local fallback that survives a page refresh.
 */
const STORAGE_KEY = 'pendingVerificationEmail'

export function setPendingVerificationEmail(email: string): void {
  sessionStorage.setItem(STORAGE_KEY, email)
}

export function getPendingVerificationEmail(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function clearPendingVerificationEmail(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
