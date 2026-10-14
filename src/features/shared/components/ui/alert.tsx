import type { ReactNode } from 'react'

import { cn } from '@/features/shared/lib/cn'

export function Alert({
  children,
  tone = 'danger',
  className,
}: {
  children: ReactNode
  tone?: 'danger' | 'success' | 'muted'
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md px-3 py-2.5 text-left text-sm',
        tone === 'danger' && 'bg-danger-bg text-danger',
        tone === 'success' && 'bg-success-bg text-success',
        tone === 'muted' && 'bg-muted text-text',
        className,
      )}
    >
      {children}
    </div>
  )
}
