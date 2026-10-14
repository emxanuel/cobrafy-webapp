import { cn } from '@/features/shared/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-muted animate-pulse rounded', className)} />
}
