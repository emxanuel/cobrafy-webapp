import type { ReactNode } from 'react'

export function StickyActionBar({
  summary,
  total,
  children,
  hint,
}: {
  summary: ReactNode
  total: ReactNode
  children: ReactNode
  hint?: string
}) {
  return (
    <div
      aria-label="Barra fija inferior"
      className="border-border bg-bg fixed bottom-0 left-1/2 z-30 w-full max-w-[1126px] -translate-x-1/2 border-t px-4 pt-3 shadow-[0_-6px_16px_-8px_rgba(0,0,0,.18)]"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="mb-2 flex justify-between text-sm">
        <b className="text-heading tabular-nums">{summary}</b>
        <span>
          Total <b className="text-heading tabular-nums">{total}</b>
        </span>
      </div>
      {children}
      {hint ? <p className="text-text m-0 mt-1 text-center text-sm">{hint}</p> : null}
    </div>
  )
}
