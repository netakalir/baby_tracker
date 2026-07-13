interface BannerProps {
  message: string
  variant?: 'error' | 'info'
}

const variantClasses = {
  error: 'border-error-500 bg-error-50 text-error-500',
  info: 'border-brand-300 bg-brand-50 text-brand-700',
}

export function Banner({ message, variant = 'info' }: BannerProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-sm border px-4 py-3 text-sm ${variantClasses[variant]}`}
    >
      {message}
    </div>
  )
}
