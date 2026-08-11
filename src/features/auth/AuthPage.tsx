import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { toFriendlyAuthErrorMessage } from '../../lib/errorMessages'
import { signIn, signUp } from './api'
import { setPendingVerificationEmail } from './pendingVerificationEmail'
import { signInSchema, signUpSchema } from './schemas'

type Mode = 'signIn' | 'signUp'

interface FieldErrors {
  email?: string
  password?: string
}

function isEmailNotConfirmedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'email_not_confirmed'
  )
}

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signUp' ? 'signUp' : 'signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const signInMutation = useMutation({
    mutationFn: signIn,
    onError: (error) => {
      if (isEmailNotConfirmedError(error)) {
        setPendingVerificationEmail(email)
        navigate('/auth/verify-email')
      }
    },
  })
  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: () => {
      setPendingVerificationEmail(email)
      navigate('/auth/verify-email')
    },
  })

  const activeMutation = mode === 'signIn' ? signInMutation : signUpMutation

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const schema = mode === 'signIn' ? signInSchema : signUpSchema
    const result = schema.safeParse({ email, password })

    if (!result.success) {
      const errors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    activeMutation.mutate(result.data)
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setFieldErrors({})
    signInMutation.reset()
    signUpMutation.reset()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">
          {mode === 'signIn' ? 'התחברות' : 'הרשמה'}
        </h1>
        <p className="mb-6 text-sm text-neutral-600">מעקב יומי אחרי התינוק, משותף בין ההורים</p>

        <div className="mb-6 flex rounded-sm border border-neutral-200 p-1 text-sm">
          <button
            type="button"
            onClick={() => switchMode('signIn')}
            className={`flex-1 rounded-sm py-1.5 transition-colors duration-fast ${
              mode === 'signIn' ? 'bg-brand-500 text-on-accent' : 'text-neutral-600'
            }`}
          >
            התחברות
          </button>
          <button
            type="button"
            onClick={() => switchMode('signUp')}
            className={`flex-1 rounded-sm py-1.5 transition-colors duration-fast ${
              mode === 'signUp' ? 'bg-brand-500 text-on-accent' : 'text-neutral-600'
            }`}
          >
            הרשמה
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              hasError={Boolean(fieldErrors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FormError message={fieldErrors.email} />
          </div>

          <div>
            <Label htmlFor="password">סיסמה</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              value={password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FormError message={fieldErrors.password} />
          </div>

          {mode === 'signIn' && (
            <Link to="/auth/forgot-password" className="text-sm text-brand-600 hover:underline">
              שכחת סיסמה?
            </Link>
          )}

          {activeMutation.isError && (
            <Banner variant="error" message={toFriendlyAuthErrorMessage(activeMutation.error)} />
          )}

          <Button type="submit" isLoading={activeMutation.isPending}>
            {mode === 'signIn' ? 'התחברות' : 'הרשמה'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
