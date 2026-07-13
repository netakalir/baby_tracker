import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { useAuth } from '../auth/useAuth'
import { useOnboardingStatus } from './useOnboardingStatus'
import { addChild } from './api'
import { addChildSchema } from './schemas'

interface FieldErrors {
  name?: string
  birthDate?: string
}

export function AddChildScreen() {
  const { user } = useAuth()
  const { data: onboardingState } = useOnboardingStatus()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: (input: { name: string; birthDate: string }) =>
      addChild(onboardingState!.familyId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status', user!.id] })
      navigate('/today')
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = addChildSchema.safeParse({ name, birthDate })
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
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">הוסף את הילד הראשון</h1>
        <p className="mb-6 text-sm text-neutral-600">שם ותאריך לידה, כדי שנוכל להתחיל לעקוב</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="childName">שם הילד/ה</Label>
            <Input
              id="childName"
              value={name}
              hasError={Boolean(fieldErrors.name)}
              onChange={(event) => setName(event.target.value)}
            />
            <FormError message={fieldErrors.name} />
          </div>

          <div>
            <Label htmlFor="birthDate">תאריך לידה</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              hasError={Boolean(fieldErrors.birthDate)}
              onChange={(event) => setBirthDate(event.target.value)}
            />
            <FormError message={fieldErrors.birthDate} />
          </div>

          {mutation.isError && <Banner variant="error" message="לא הצלחנו להוסיף את הילד. נסה שוב." />}

          <Button type="submit" isLoading={mutation.isPending}>
            המשך
          </Button>
        </form>
      </Card>
    </div>
  )
}
