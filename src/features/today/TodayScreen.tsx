import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { signOut } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { QuickLogButtons } from './QuickLogButtons'

export function TodayScreen() {
  const { user } = useAuth()
  const { data: onboardingState } = useOnboardingStatus()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Drop any cached data belonging to the user who just signed out.
      queryClient.clear()
      navigate('/auth')
    },
  })

  if (!onboardingState) return <LoadingScreen />

  const child = onboardingState.firstChild

  return (
    <div className="min-h-screen bg-neutral-50 px-4 pb-40 pt-8">
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <Card className="max-w-sm text-center">
          <h1 className="mb-2 text-2xl font-semibold text-neutral-900">{child?.name}</h1>
          <p className="mb-6 text-sm text-neutral-600">מחובר/ת כ-{user?.email}</p>
          <Button
            variant="ghost"
            onClick={() => signOutMutation.mutate()}
            isLoading={signOutMutation.isPending}
          >
            התנתקות
          </Button>
        </Card>
      </div>

      {child && <QuickLogButtons childId={child.id} />}
    </div>
  )
}
