import type { ReactNode } from 'react'

import { cn } from '@/features/shared/lib/cn'

export function LoadingState({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div aria-busy="true" className={cn(className)}>
      <p className="sr-only">Cargando…</p>
      {children}
    </div>
  )
}
