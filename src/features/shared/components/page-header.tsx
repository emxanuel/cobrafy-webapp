import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="text-left">
        <h1 className="m-0 text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1">{description}</p> : null}
      </div>
      {action}
    </header>
  )
}
