import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { useSessionStore } from '@/features/auth/stores/session-store'
import {
  activeMembership,
  useBusinessStore,
} from '@/features/business/stores/business-store'
import { displayFreeText, formatDocumentLine } from '@/features/clients/lib/display-document'
import { useVerifyClientMutation } from '@/features/clients/hooks/use-clients-queries'
import type { DocType } from '@/features/clients/services/types'
import { PageHeader } from '@/features/shared/components/page-header'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button, buttonVariants } from '@/features/shared/components/ui/button'
import { Field, TextInput } from '@/features/shared/components/ui/field'
import { cn } from '@/features/shared/lib/cn'
import { formatDate } from '@/features/shared/lib/format-date'
import { normalizeDocumentInput } from '@/features/shared/lib/mask-document'
import { canCreateClients } from '@/features/shared/lib/roles'

type CheckResult = {
  kind: 'blocked' | 'clear' | 'missing'
  name?: string
  docType?: DocType
  document?: string
  reason?: string | null
  since?: string | null
  clientId?: string | null
}

export function CheckPage() {
  const [docType, setDocType] = useState<DocType>('cedula')
  const [document, setDocument] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const verify = useVerifyClientMutation()
  const memberships = useSessionStore((s) => s.memberships)
  const activeBusinessId = useBusinessStore((s) => s.activeBusinessId)
  const role = activeMembership(memberships, activeBusinessId)?.role ?? null

  function validate(): string {
    const normalized = normalizeDocumentInput(document)
    if (docType === 'cedula') {
      if (!/^\d{11}$/.test(normalized)) return 'Escribe una cédula de 11 dígitos.'
      return ''
    }
    if (!normalized) return 'Escribe el número de pasaporte.'
    return ''
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const error = validate()
    setFieldError(error)
    if (error) return
    verify.mutate(
      { doc_type: docType, document: normalizeDocumentInput(document) },
      {
        onSuccess: (data) => {
          if (!data.check.found) {
            setResult({ kind: 'missing' })
            return
          }
          setResult({
            kind: data.check.is_blocked ? 'blocked' : 'clear',
            name: data.client?.name,
            docType: data.client?.doc_type ?? docType,
            document: data.client?.document ?? document,
            reason: data.check.blocked_reason,
            since: data.blockedAt,
            clientId: data.check.client_id,
          })
        },
        onError: () => {
          setResult(null)
        },
      },
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Verificar bloqueo"
        description="Consulta si un documento está bloqueado antes de prestar."
      />

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field id="check-doc-type" label="Tipo de documento">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className={cn(docType === 'cedula' && 'border-accent text-accent')}
              aria-pressed={docType === 'cedula'}
              onClick={() => {
                setDocType('cedula')
                setFieldError('')
                setResult(null)
                verify.reset()
              }}
            >
              Cédula
            </Button>
            <Button
              variant="outline"
              className={cn(docType === 'pasaporte' && 'border-accent text-accent')}
              aria-pressed={docType === 'pasaporte'}
              onClick={() => {
                setDocType('pasaporte')
                setFieldError('')
                setResult(null)
                verify.reset()
              }}
            >
              Pasaporte
            </Button>
          </div>
        </Field>
        <Field
          id="check-document"
          label="Número de documento"
          error={fieldError}
          hint={fieldError ? undefined : 'Con o sin guiones.'}
        >
          <TextInput
            id="check-document"
            className="font-mono"
            inputMode={docType === 'cedula' ? 'numeric' : 'text'}
            placeholder={docType === 'cedula' ? '001-0000000-0' : 'AB1234567'}
            value={document}
            error={fieldError}
            onChange={(event) => {
              setDocument(event.target.value)
              setFieldError('')
              setResult(null)
              verify.reset()
            }}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={verify.isPending}>
          {verify.isPending ? 'Verificando…' : 'Verificar'}
        </Button>
      </form>

      {verify.isError ? (
        <Alert>No se pudo verificar. Inténtalo de nuevo.</Alert>
      ) : null}

      {result?.kind === 'blocked' ? (
        <div role="status" className="border-danger bg-danger-bg rounded-md border-2 px-4 py-4">
          <p className="text-danger m-0 text-xl font-semibold">⛔ Bloqueado</p>
          <p className="text-heading m-0 mt-1">
            {result.name ?? 'Cliente'} · {formatDocumentLine(result.docType, result.document, role)}
          </p>
          {result.reason ? (
            <p className="m-0 mt-2 text-sm">
              <span className="text-heading text-sm font-medium">Motivo:</span>{' '}
              {displayFreeText(result.reason, role)}
            </p>
          ) : null}
          {result.since ? (
            <p className="m-0 text-sm">Desde el {formatDate(result.since)}</p>
          ) : null}
          {result.clientId ? (
            <Link
              to={`/clientes/${result.clientId}`}
              className={`${buttonVariants({ variant: 'link' })} mt-2`}
            >
              Ver ficha
            </Link>
          ) : null}
        </div>
      ) : null}

      {result?.kind === 'clear' ? (
        <div role="status" className="border-success bg-success-bg rounded-md border-2 px-4 py-4">
          <p className="text-success m-0 text-xl font-semibold">✓ No está bloqueado</p>
          <p className="text-heading m-0 mt-1">
            {result.name ?? 'Cliente'} · {formatDocumentLine(result.docType, result.document, role)}
          </p>
          {result.clientId ? (
            <Link to={`/clientes/${result.clientId}`} className="text-accent mt-2 inline-block">
              Ver ficha
            </Link>
          ) : null}
        </div>
      ) : null}

      {result?.kind === 'missing' ? (
        <div role="status" className="bg-muted rounded-md px-4 py-4">
          <p className="text-heading m-0 text-xl font-semibold">No encontramos ese documento</p>
          <p className="m-0 mt-1 text-sm">
            No hay ningún cliente con ese documento en este negocio.
          </p>
          {canCreateClients(role) ? (
            <Link
              to="/clientes/nuevo"
              className={`${buttonVariants({ variant: 'outline' })} mt-3 no-underline`}
            >
              Registrar cliente
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
