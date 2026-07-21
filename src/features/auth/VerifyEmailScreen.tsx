import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { toFriendlyAuthErrorMessage } from '../../lib/errorMessages'
import { supabase } from '../../lib/supabase'
import { resendVerificationEmail, signOut } from './api'
import { clearPendingVerificationEmail, getPendingVerificationEmail } from './pendingVerificationEmail'
import { useAuth } from './useAuth'

export function VerifyEmailScreen() {
  const { session, user, isEmailVerified } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [notYetConfirmedNotice, setNotYetConfirmedNotice] = useState(false)

  // A confirmed session can appear here without a page reload if the user
  // clicked the confirmation link in another tab (Supabase syncs the new
  // session across tabs via localStorage).
  useEffect(() => {
    if (session && isEmailVerified) {
      clearPendingVerificationEmail()
    }
  }, [session, isEmailVerified])

  const email = user?.email ?? getPendingVerificationEmail()

  const checkAgainMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    onSuccess: async (refreshedSession) => {
      if (refreshedSession?.user.email_confirmed_at) {
        clearPendingVerificationEmail()
        await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
        navigate('/')
      } else {
        setNotYetConfirmedNotice(true)
      }
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => resendVerificationEmail(email ?? ''),
  })

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      clearPendingVerificationEmail()
      navigate('/auth')
    },
  })

  if (session && isEmailVerified) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">אשר את כתובת האימייל</h1>
        <p className="mb-6 text-sm text-neutral-600">
          {email ? (
            <>
              שלחנו קישור אישור לכתובת <span className="font-medium text-neutral-900">{email}</span>. יש
              ללחוץ עליו כדי להמשיך.
            </>
          ) : (
            'יש ללחוץ על קישור האישור שנשלח לתיבת המייל שלך כדי להמשיך.'
          )}
        </p>

        <div className="flex flex-col gap-3">
          <Button onClick={() => checkAgainMutation.mutate()} isLoading={checkAgainMutation.isPending}>
            אישרתי, בדוק שוב
          </Button>
          {email && (
            <Button
              variant="secondary"
              onClick={() => resendMutation.mutate()}
              isLoading={resendMutation.isPending}
            >
              שלח שוב את מייל האישור
            </Button>
          )}
          <Button variant="ghost" onClick={() => signOutMutation.mutate()} isLoading={signOutMutation.isPending}>
            התנתקות
          </Button>
        </div>

        {notYetConfirmedNotice && (
          <div className="mt-4">
            <Banner variant="info" message="עדיין לא אישרת את המייל. לחץ על הקישור ואז נסה שוב." />
          </div>
        )}
        {resendMutation.isSuccess && (
          <div className="mt-4">
            <Banner variant="info" message="המייל נשלח שוב." />
          </div>
        )}
        {(checkAgainMutation.isError || resendMutation.isError) && (
          <div className="mt-4">
            <Banner
              variant="error"
              message={toFriendlyAuthErrorMessage(checkAgainMutation.error ?? resendMutation.error)}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
