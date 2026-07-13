import { Navigate } from 'react-router-dom'
import { ErrorScreen } from '../components/ui/ErrorScreen'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { useAuth } from '../features/auth/useAuth'
import { useOnboardingStatus } from '../features/onboarding/useOnboardingStatus'
import { pathForOnboardingStatus } from './onboardingPath'

export function RootRedirect() {
  const { session, isEmailVerified, isLoading: isAuthLoading } = useAuth()
  const onboardingQuery = useOnboardingStatus()

  if (isAuthLoading) return <LoadingScreen />
  if (!session) return <Navigate to="/auth" replace />
  if (!isEmailVerified) return <Navigate to="/auth/verify-email" replace />
  if (onboardingQuery.isError) return <ErrorScreen onRetry={() => onboardingQuery.refetch()} />
  if (!onboardingQuery.data) return <LoadingScreen />

  return <Navigate to={pathForOnboardingStatus(onboardingQuery.data.status)} replace />
}
