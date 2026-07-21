import { Button } from './Button'
import { Card } from './Card'

interface ErrorScreenProps {
  message?: string
  onRetry: () => void
}

export function ErrorScreen({ message = 'לא הצלחנו לטעון את הנתונים.', onRetry }: ErrorScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm text-center">
        <p className="mb-4 text-sm text-neutral-600">{message}</p>
        <Button onClick={onRetry}>נסה שוב</Button>
      </Card>
    </div>
  )
}
