import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export function Input({ hasError = false, className = '', id, 'aria-describedby': ariaDescribedBy, ...rest }: InputProps) {
  const borderClass = hasError
    ? 'border-error-500 focus:ring-error-500'
    : 'border-neutral-200 focus:ring-brand-500'
  const errorId = hasError && id ? `${id}-error` : undefined

  return (
    <input
      id={id}
      aria-invalid={hasError || undefined}
      aria-describedby={ariaDescribedBy ?? errorId}
      className={`w-full rounded-sm border bg-neutral-0 px-3 py-2 text-sm text-neutral-900 outline-none transition-colors duration-fast focus:ring-2 ${borderClass} ${className}`}
      {...rest}
    />
  )
}
