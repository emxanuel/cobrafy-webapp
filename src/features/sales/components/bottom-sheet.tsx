import { useEffect, useRef, type ReactNode } from 'react'

export function BottomSheet({
  title,
  titleId,
  children,
  onClose,
  closeDisabled = false,
}: {
  title: string
  titleId: string
  children: ReactNode
  onClose: () => void
  closeDisabled?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = panelRef.current
    const focusables = () =>
      root
        ? Array.from(
            root.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          )
        : []
    focusables()[0]?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !closeDisabled) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lastFocus.current?.focus()
    }
  }, [closeDisabled, onClose])

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-[rgba(8,6,13,.45)]"
        disabled={closeDisabled}
        onClick={() => {
          if (!closeDisabled) onClose()
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-bg absolute right-0 bottom-0 left-0 mx-auto flex max-h-[90svh] w-full max-w-[1126px] flex-col gap-3.5 overflow-auto rounded-t-2xl px-4 pt-2 pb-5"
      >
        <div className="bg-border mx-auto mt-1 h-1 w-10 rounded" />
        <h2 id={titleId} className="m-0 text-xl">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
