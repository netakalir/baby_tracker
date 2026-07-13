import { Card } from '../../components/ui/Card'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { useAuth } from '../auth/useAuth'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'

export function TodayScreen() {
  const { user } = useAuth()
  const { data: onboardingState } = useOnboardingStatus()

  if (!onboardingState) return <LoadingScreen />

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
          {onboardingState.firstChild?.name}
        </h1>
        <p className="text-sm text-neutral-600">מחובר/ת כ-{user?.email}</p>
      </Card>
    </div>
  )
}
