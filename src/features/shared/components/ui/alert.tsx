import type { ReactNode } from 'react'

import { cn } from '@/features/shared/lib/cn'

const TONES = {
  danger: 'bg-danger-bg text-danger border-danger/35',
  success: 'bg-success-bg text-success border-transparent',
  muted: 'bg-muted text-text border-transparent',
  warning: 'bg-warning-bg text-warning border-warning-border',
} as const

export function Alert({
  children,
  tone = 'danger',
  className,
  title,
  icon,
  action,
}: {
  children?: ReactNode
  tone?: keyof typeof TONES
  className?: string
  title?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role={tone === 'warning' ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm',
        TONES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="text-lg leading-tight">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="m-0 font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'text-heading' : undefined}>{children}</div> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  )
}
