import { supabase } from '../../lib/supabase'
import type { ForgotPasswordInput, ResetPasswordInput, SignInInput, SignUpInput } from './schemas'

export async function signUp({ email, password }: SignUpInput): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signIn({ email, password }: SignInInput): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/**
 * Starts the Google OAuth flow. On success the browser is redirected to Google
 * and back to the app root, where `AuthProvider` picks up the session and
 * `RootRedirect` routes on by onboarding status - so this resolves only when the
 * redirect could NOT be started (an error worth surfacing). Google accounts
 * arrive with a confirmed email, so they skip the email-verification step.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset({ email }: ForgotPasswordInput): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword({ password }: ResetPasswordInput): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}
