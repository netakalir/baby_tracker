import type { LabelHTMLAttributes } from 'react'

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className = '', ...rest }: LabelProps) {
  return (
    <label
      className={`mb-1 block text-sm font-medium text-neutral-800 ${className}`}
      {...rest}
    />
  )
}
