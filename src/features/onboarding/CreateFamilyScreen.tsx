import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { useAuth } from '../auth/useAuth'
import { createFamily } from './api'
import { createFamilySchema } from './schemas'

export function CreateFamilyScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()

  const mutation = useMutation({
    mutationFn: (input: { name?: string }) => createFamily(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status', user!.id] })
      navigate('/onboarding/add-child')
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = createFamilySchema.safeParse({ name })
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
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">צור משפחה חדשה</h1>
        <p className="mb-6 text-sm text-neutral-600">אפשר לתת שם, או להשאיר ריק ולהשתמש בשם ברירת המחדל</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">שם המשפחה (אופציונלי)</Label>
            <Input
              id="name"
              value={name}
              placeholder="המשפחה שלי"
              hasError={Boolean(fieldError)}
              onChange={(event) => setName(event.target.value)}
            />
            <FormError message={fieldError} />
          </div>

          {mutation.isError && <Banner variant="error" message="לא הצלחנו ליצור את המשפחה. נסה שוב." />}

          <Button type="submit" isLoading={mutation.isPending}>
            המשך
          </Button>
        </form>

        <Link to="/onboarding" className="mt-4 block text-center text-sm text-brand-600 hover:underline">
          חזרה
        </Link>
      </Card>
    </div>
  )
}
