import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { toFriendlyAuthErrorMessage } from '../../lib/errorMessages'
import { requestPasswordReset } from './api'
import { forgotPasswordSchema } from './schemas'

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const mutation = useMutation({ mutationFn: requestPasswordReset })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = forgotPasswordSchema.safeParse({ email })
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
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">שחזור סיסמה</h1>
        <p className="mb-6 text-sm text-neutral-600">נשלח קישור לאיפוס סיסמה לכתובת האימייל שלך</p>

        {mutation.isSuccess ? (
          <Banner variant="info" message="אם קיים חשבון עם האימייל הזה, נשלח אליו קישור לאיפוס סיסמה." />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                hasError={Boolean(fieldError)}
                onChange={(event) => setEmail(event.target.value)}
              />
              <FormError message={fieldError} />
            </div>

            {mutation.isError && (
              <Banner variant="error" message={toFriendlyAuthErrorMessage(mutation.error)} />
            )}

            <Button type="submit" isLoading={mutation.isPending}>
              שלח קישור לאיפוס
            </Button>
          </form>
        )}

        <Link to="/auth" className="mt-4 block text-center text-sm text-brand-600 hover:underline">
          חזרה להתחברות
        </Link>
      </Card>
    </div>
  )
}
