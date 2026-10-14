import type { ReactNode } from 'react'

import { Ticks } from '@/features/shared/components/ticks'

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
        <p className="text-accent m-0 text-sm tracking-wide uppercase">Cobrafy</p>
        <div className="w-full max-w-md text-center">
          <h1 className="mt-0 mb-2 text-4xl tracking-tight">{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="w-full max-w-md">{children}</div>
      </section>
      <Ticks />
      <div className="border-border h-12 border-t" />
    </div>
  )
}
