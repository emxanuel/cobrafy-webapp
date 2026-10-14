import { LoadingState } from '@/features/shared/components/ui/loading-state'

export function RouteFallback() {
  return (
    <LoadingState className="flex min-h-svh items-center justify-center px-4">
      <p>Cargando…</p>
    </LoadingState>
  )
}
