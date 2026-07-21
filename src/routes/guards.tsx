import { Navigate, Outlet } from 'react-router-dom'
import { ErrorScreen } from '../components/ui/ErrorScreen'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { useAuth } from '../features/auth/useAuth'
import { useOnboardingStatus } from '../features/onboarding/useOnboardingStatus'
import { pathForOnboardingStatus } from './onboardingPath'

/** Blocks unauthenticated users. Renders nested routes once a session exists. */
export function RequireAuth() {
  const { session, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!session) return <Navigate to="/auth" replace />

  return <Outlet />
}

/** Blocks users whose email is not yet confirmed. Must be nested inside RequireAuth. */
export function RequireVerifiedEmail() {
  const { isEmailVerified } = useAuth()

  if (!isEmailVerified) return <Navigate to="/auth/verify-email" replace />

  return <Outlet />
}

/** Used on /auth* routes: signed-in users have nothing to do there. */
export function RedirectIfSignedIn() {
  const { session, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}

/** Used on /auth/verify-email: already-verified users move on immediately. */
export function RedirectIfVerified() {
  const { isEmailVerified } = useAuth()

  if (isEmailVerified) return <Navigate to="/" replace />

  return <Outlet />
}

/**
 * Guards onboarding/today routes against the current onboarding status,
 * redirecting to wherever that status actually belongs.
 */
export function RequireOnboardingStatus({ allow }: { allow: 'no-family' | 'no-child' | 'ready' }) {
  const query = useOnboardingStatus()

  if (query.isPending) return <LoadingScreen />
  if (query.isError) return <ErrorScreen onRetry={() => query.refetch()} />
  if (query.data.status !== allow) {
    return <Navigate to={pathForOnboardingStatus(query.data.status)} replace />
  }

  return <Outlet />
}
