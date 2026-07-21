import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { toFriendlyAuthErrorMessage } from '../../lib/errorMessages'
import { updatePassword } from './api'
import { resetPasswordSchema } from './schemas'

interface FieldErrors {
  password?: string
  confirmPassword?: string
}

export function ResetPasswordScreen() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: () => navigate('/'),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = resetPasswordSchema.safeParse({ password, confirmPassword })
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
    mutation.mutate(result.data)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">קביעת סיסמה חדשה</h1>
        <p className="mb-6 text-sm text-neutral-600">בחר סיסמה חדשה לחשבון שלך</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="password">סיסמה חדשה</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FormError message={fieldErrors.password} />
          </div>

          <div>
            <Label htmlFor="confirmPassword">אימות סיסמה</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              hasError={Boolean(fieldErrors.confirmPassword)}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <FormError message={fieldErrors.confirmPassword} />
          </div>

          {mutation.isError && (
            <Banner variant="error" message={toFriendlyAuthErrorMessage(mutation.error)} />
          )}

          <Button type="submit" isLoading={mutation.isPending}>
            שמירת סיסמה
          </Button>
        </form>
      </Card>
    </div>
  )
}
