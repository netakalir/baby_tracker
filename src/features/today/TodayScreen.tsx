import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { signOut } from '../auth/api'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { DayClock } from './DayClock'
import { QuickLogButtons } from './QuickLogButtons'
import { useTodayEvents } from './useTodayEvents'

/** "יום שלישי, 22 ביולי" - the current day, in Israel-local terms. */
const headerDateFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

interface TodayContentProps {
  childId: string
  childName: string
}

/**
 * The live "Today" view for a single child: date header, the 24-hour clock fed
 * by the child's events, and the sticky quick-log buttons. Split out so the
 * `useTodayEvents` hook is only mounted once we actually have a child.
 */
function TodayContent({ childId, childName }: TodayContentProps) {
  const today = new Date()
  const { data: events, isError, error } = useTodayEvents(childId)

  return (
    <>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">{childName}</h1>
        <p className="text-sm text-neutral-600">{headerDateFormatter.format(today)}</p>
      </header>

      {isError && (
        <div className="mb-4">
          <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
        </div>
      )}

      <DayClock events={events ?? []} date={today} />

      <QuickLogButtons childId={childId} />
    </>
  )
}

export function TodayScreen() {
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
    <div className="min-h-screen bg-neutral-50 px-4 pb-40 pt-6">
      <div className="mx-auto flex max-w-sm flex-col">
        <div className="mb-2 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => signOutMutation.mutate()}
            isLoading={signOutMutation.isPending}
          >
            התנתקות
          </Button>
        </div>

        {child ? (
          <TodayContent childId={child.id} childName={child.name} />
        ) : (
          <p className="text-center text-sm text-neutral-600">לא נמצא/ה ילד/ה במשפחה</p>
        )}
      </div>
    </div>
  )
}
