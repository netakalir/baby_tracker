import { SettingsHeader } from './SettingsHeader'

interface SettingsPlaceholderProps {
  title: string
}

/**
 * Temporary body for a Settings sub-screen whose real content is built in a
 * later slice (12d-12g). Each sub-screen file wraps this with its own title, so
 * a later slice can replace exactly one file without touching the others.
 */
export function SettingsPlaceholder({ title }: SettingsPlaceholderProps) {
  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title={title} backTo="/settings" />
        <p className="mt-10 text-center text-sm text-neutral-600">בקרוב</p>
      </div>
    </div>
  )
}
