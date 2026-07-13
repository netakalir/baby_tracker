import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-neutral-0 hover:bg-brand-600 disabled:bg-brand-300',
  secondary:
    'bg-neutral-0 text-neutral-900 border border-neutral-200 hover:bg-neutral-100 disabled:text-neutral-400',
  ghost: 'bg-transparent text-brand-600 hover:bg-brand-50 disabled:text-neutral-400',
}

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`w-full rounded-md px-4 py-3 text-sm font-medium transition-colors duration-fast disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? 'רגע...' : children}
    </button>
  )
}
