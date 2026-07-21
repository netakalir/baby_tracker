import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`w-full rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}
