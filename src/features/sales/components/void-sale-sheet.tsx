import { useState } from 'react'

import { BottomSheet } from '@/features/sales/components/bottom-sheet'
import { VOID_NETWORK_BODY, VOID_NETWORK_TITLE } from '@/features/sales/lib/copy'
import {
  VOID_REASON_MAX,
  isVoidReasonValid,
  trimmedReasonLength,
} from '@/features/sales/lib/void-reason'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, TextArea } from '@/features/shared/components/ui/field'

const FRONT_REASON_ERROR = 'El motivo debe tener entre 5 y 500 caracteres.'

export function VoidSaleSheet({
  saleNumber,
  installmentsCount,
  reason,
  onReason,
  pending,
  submitting,
  networkError,
  fieldError,
  onSubmit,
  onClose,
}: {
  saleNumber: number
  installmentsCount: number
  reason: string
  onReason: (value: string) => void
  pending: boolean
  submitting: boolean
  networkError: boolean
  fieldError: string | null
  onSubmit: () => void
  onClose: () => void
}) {
  const [touched, setTouched] = useState(false)
  const trimmedLen = trimmedReasonLength(reason)
  const valid = isVoidReasonValid(reason)
  const frontError =
    (touched || Boolean(fieldError)) && !valid && !fieldError ? FRONT_REASON_ERROR : null
  const shownFieldError = fieldError || frontError
  const busy = pending || submitting

  function trySubmit() {
    setTouched(true)
    if (!valid || busy) return
    onSubmit()
  }

  return (
    <BottomSheet
      title={`¿Anular la venta #${saleNumber}?`}
      titleId="void-sale-title"
      onClose={onClose}
      closeDisabled={busy}
    >
      <Alert tone="danger" icon="⚠" title="Esta acción no se puede deshacer.">
        Las {installmentsCount} cuotas quedan canceladas y la venta deja de contar en la cartera.
      </Alert>

      {networkError ? (
        <Alert tone="danger" icon="✕" title={VOID_NETWORK_TITLE}>
          {VOID_NETWORK_BODY}
        </Alert>
      ) : null}

      <Field
        id="void-reason"
        label="Motivo de la anulación"
        error={shownFieldError ?? undefined}
        hint={shownFieldError ? undefined : 'Entre 5 y 500 caracteres. Queda en la bitácora.'}
      >
        <TextArea
          id="void-reason"
          rows={3}
          maxLength={VOID_REASON_MAX}
          placeholder="Ej.: Se registró con el precio equivocado."
          value={reason}
          disabled={busy}
          error={shownFieldError ?? undefined}
          onChange={(event) => onReason(event.target.value)}
          onBlur={() => setTouched(true)}
        />
      </Field>
      <p className="m-0 text-right text-xs tabular-nums">
        {trimmedLen}/{VOID_REASON_MAX}
      </p>

      <Button
        variant="danger"
        className="min-h-12 w-full"
        disabled={!valid || busy}
        onClick={trySubmit}
      >
        {busy ? 'Anulando…' : 'Anular venta'}
      </Button>
      <Button variant="ghost" className="w-full" disabled={busy} onClick={onClose}>
        Cancelar
      </Button>
    </BottomSheet>
  )
}
