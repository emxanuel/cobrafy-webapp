import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router'

import { useLogoutMutation } from '@/features/auth/hooks/use-auth'
import { useSessionStore } from '@/features/auth/stores/session-store'
import { switchBusiness } from '@/features/business/lib/switch-business'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { Button } from '@/features/shared/components/ui/button'
import { Ticks } from '@/features/shared/components/ticks'
import { cn } from '@/features/shared/lib/cn'
import { canManageMembers, ROLE_LABEL } from '@/features/shared/lib/roles'
import { queryClient } from '@/query-client'

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'block rounded-md px-3 py-2.5 text-left',
    isActive ? 'bg-accent-bg text-heading font-medium' : 'text-text hover:bg-muted',
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const user = useSessionStore((s) => s.user)
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const membership = activeMembership(memberships, activeBusinessId)
  const logout = useLogoutMutation()
  const navigate = useNavigate()
  const role = membership?.role ?? null
  const hasPin = membership?.has_pin ?? false

  function close() {
    setOpen(false)
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 text-left">
          <p className="text-accent m-0 text-xs tracking-wide uppercase">Cobrafy</p>
          <p className="text-heading m-0 truncate font-medium">
            {membership?.business_name ?? 'Tu negocio'}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 px-3 md:hidden"
          aria-expanded={open}
          aria-controls="app-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
          <span>Menú</span>
        </Button>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          id="app-menu"
          className={cn(
            'border-border bg-bg md:block md:w-56 md:shrink-0 md:border-r',
            open ? 'block' : 'hidden',
          )}
        >
          <nav className="flex flex-col gap-1 p-3" aria-label="Principal">
            <NavLink to="/clientes" className={navClass} onClick={close}>
              Clientes
            </NavLink>
            {canManageMembers(role) ? (
              <NavLink to="/equipo" className={navClass} onClick={close}>
                Equipo
              </NavLink>
            ) : null}
            <NavLink to="/clave-rapida" className={navClass} onClick={close}>
              {hasPin ? 'Cambiar clave rápida' : 'Configurar clave rápida'}
            </NavLink>
            {memberships.length > 1 ? (
              <div className="border-border mt-2 border-t pt-2">
                <p className="text-text px-3 py-1 text-xs uppercase">Negocio</p>
                {memberships.map((item) => (
                  <button
                    key={item.business_id}
                    type="button"
                    className={cn(
                      navClass({ isActive: item.business_id === activeBusinessId }),
                      'w-full',
                    )}
                    onClick={() => {
                      close()
                      flushSync(() => {
                        navigate('/clientes', { replace: true })
                      })
                      void switchBusiness(queryClient, item.business_id)
                    }}
                  >
                    {item.business_name}
                    <span className="text-text ml-1 text-xs">
                      ({ROLE_LABEL[item.role]})
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </nav>
          <div className="border-border mt-auto border-t p-3">
            <p className="text-heading m-0 truncate text-sm">{user?.name}</p>
            {role ? <p className="m-0 text-sm">{ROLE_LABEL[role]}</p> : null}
            <Button
              variant="ghost"
              className="mt-2 w-full justify-start"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Salir
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
            <Outlet />
          </div>
          <Ticks />
        </main>
      </div>
    </div>
  )
}
