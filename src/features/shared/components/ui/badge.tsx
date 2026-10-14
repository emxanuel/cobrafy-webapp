import type { ReactNode } from 'react'

import { cn } from '@/features/shared/lib/cn'

const TONES = {
  muted: 'bg-muted text-text',
  accent: 'bg-accent-bg text-accent',
  danger: 'bg-danger-bg text-danger',
  success: 'bg-success-bg text-success',
} as const

export function Badge({
  tone = 'muted',
  className,
  children,
}: {
  tone?: keyof typeof TONES
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  )
}
