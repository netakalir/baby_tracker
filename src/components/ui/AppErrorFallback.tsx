import { Button } from './Button'
import { Card } from './Card'

interface AppErrorFallbackProps {
  /** Resets the Sentry ErrorBoundary and re-renders the app tree. */
  onReset: () => void
}

/**
 * Last-resort fallback shown by the app-level Sentry ErrorBoundary when a render
 * error would otherwise blank the screen. Intentionally minimal and on-brand
 * (RTL Hebrew, neutral surface, brand-colored primary action) — it never shows
 * raw error text (which could contain a baby name or other PII) and offers a
 * single "try again" action plus a full reload as a fallback.
 */
export function AppErrorFallback({ onReset }: AppErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-sm text-center">
        <h1 className="mb-2 text-lg font-semibold text-neutral-900">משהו השתבש</h1>
        <p className="mb-4 text-sm text-neutral-600">
          נתקלנו בתקלה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת כדאי לרענן את
          הדף.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={onReset}>נסה שוב</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            רענן את הדף
          </Button>
        </div>
      </Card>
    </div>
  )
}
