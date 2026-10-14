import type { ReactNode } from 'react'

import { cn } from '@/features/shared/lib/cn'

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-muted rounded-md px-4 py-6 text-center', className)}>
      {title ? <p className="text-heading m-0 font-medium">{title}</p> : null}
      {children ? <p className="m-0 text-sm">{children}</p> : null}
      {action}
    </div>
  )
}
