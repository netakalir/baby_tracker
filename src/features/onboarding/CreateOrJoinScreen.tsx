import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export function CreateOrJoinScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">בואו נתחיל</h1>
        <p className="mb-6 text-sm text-neutral-600">צור משפחה חדשה, או הצטרף למשפחה קיימת עם קישור הזמנה</p>

        <div className="flex flex-col gap-3">
          <Link to="/onboarding/create">
            <Button>צור משפחה חדשה</Button>
          </Link>
          <Link to="/onboarding/join">
            <Button variant="secondary">יש לי קישור הזמנה</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
