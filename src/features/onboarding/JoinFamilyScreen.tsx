import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { useAuth } from '../auth/useAuth'
import { JoinFamilyError, joinFamilyByToken, type JoinFamilyErrorCode } from './api'
import { joinFamilySchema } from './schemas'

const ERROR_MESSAGES: Record<JoinFamilyErrorCode, string> = {
  invalid: 'קישור ההזמנה לא תקין. בדוק שהעתקת אותו נכון.',
  expired: 'ההזמנה הזו לא תקפה יותר. בקש קישור חדש.',
  used: 'ההזמנה הזו כבר נוצלה. בקש קישור חדש.',
  'already-in-family': 'אתה כבר חבר במשפחה אחת. האפליקציה תומכת במשפחה אחת בלבד למשתמש בשלב זה.',
}

function getJoinErrorMessage(error: unknown): string {
  if (error instanceof JoinFamilyError) return ERROR_MESSAGES[error.code]
  return 'לא הצלחנו להצטרף למשפחה. נסה שוב.'
}

export function JoinFamilyScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [fieldError, setFieldError] = useState<string | undefined>()

  const mutation = useMutation({
    mutationFn: (input: { token: string }) => joinFamilyByToken(user!.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status', user!.id] })
      navigate('/today')
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = joinFamilySchema.safeParse({ token })
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message)
      return
    }
    setFieldError(undefined)
    mutation.mutate(result.data)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">הצטרפות למשפחה</h1>
        <p className="mb-6 text-sm text-neutral-600">הדבק את קוד ההזמנה שקיבלת מההורה השני</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="token">קוד הזמנה</Label>
            <Input
              id="token"
              value={token}
              hasError={Boolean(fieldError)}
              onChange={(event) => setToken(event.target.value)}
            />
            <FormError message={fieldError} />
          </div>

          {mutation.isError && <Banner variant="error" message={getJoinErrorMessage(mutation.error)} />}

          <Button type="submit" isLoading={mutation.isPending}>
            הצטרפות
          </Button>
        </form>

        <Link to="/onboarding" className="mt-4 block text-center text-sm text-brand-600 hover:underline">
          חזרה
        </Link>
      </Card>
    </div>
  )
}
