import type { Role } from '@/features/auth/services/types'
import { canConfigureCredit, canEditClients } from '@/features/shared/lib/roles'
import type { Frequency } from '@/features/sales/services/types'

export const GENERIC_SALE_ERROR = 'No se pudo completar. Inténtalo de nuevo.'

function trimPercent(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/, '')
}

export const IDEMPOTENCY_REUSED_TITLE = 'Puede que esta venta ya esté registrada'
export const IDEMPOTENCY_REUSED_BODY =
  'Revisa las compras del cliente antes de intentar de nuevo.'

export function surchargeLabel(input: {
  surcharge_kind?: string | null
  surcharge_percent?: string | null
}): string {
  if (input.surcharge_kind === 'fixed_amount') return 'Recargo (monto fijo)'
  if (input.surcharge_percent) return `Recargo (${trimPercent(input.surcharge_percent)} %)`
  return 'Recargo'
}

export function formatFieldMessage(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return trimmed
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?…]$/.test(capped) ? capped : `${capped}.`
}

export function frequencyAdjective(frequency: Frequency, count: number): string {
  if (frequency === 'semanal') return count === 1 ? 'semanal' : 'semanales'
  if (frequency === 'quincenal') return count === 1 ? 'quincenal' : 'quincenales'
  return count === 1 ? 'mensual' : 'mensuales'
}

export function firstDueHint(frequency: Frequency): string {
  if (frequency === 'semanal') {
    return 'Sugerida: una semana después de hoy. Puedes cambiarla.'
  }
  if (frequency === 'quincenal') {
    return 'En quincenal se cobra el día 15 y el último día de cada mes.'
  }
  return 'Sugerida: un mes después de hoy. Puedes cambiarla.'
}

export type BannerCopy = {
  tone: 'danger' | 'warning'
  icon: string
  title: string
  body: string
  actionLabel?: string
  actionTo?: string
}

export function saleErrorBanner(
  code: string | undefined,
  role: Role | null,
  clientId: string,
  backendMessage?: string,
): BannerCopy {
  if (code === 'CLIENT_BLOCKED') {
    const reason = blockedReason(backendMessage)
    return {
      tone: 'danger',
      icon: '⛔',
      title: `Este cliente está bloqueado: ${reason}.`,
      body: 'No se le puede vender a crédito.',
      actionLabel: 'Ver ficha',
      actionTo: `/clientes/${clientId}`,
    }
  }
  if (code === 'CREDIT_SETTINGS_MISSING') {
    return canConfigureCredit(role)
      ? {
          tone: 'warning',
          icon: '⚠',
          title: 'Todavía no has configurado el crédito del negocio.',
          body: 'Configúralo para poder vender.',
          actionLabel: 'Configurar crédito',
          actionTo: 'credit-settings',
        }
      : {
          tone: 'warning',
          icon: '⚠',
          title: 'El crédito del negocio no está configurado.',
          body: 'Pídele al dueño que configure el crédito.',
        }
  }
  if (code === 'CREDIT_SETTINGS_INCOMPLETE') {
    return canConfigureCredit(role)
      ? {
          tone: 'warning',
          icon: '⚠',
          title: 'La configuración de crédito está incompleta.',
          body: 'Le falta el recargo. Complétala para poder simular y vender.',
          actionLabel: 'Revisar configuración',
          actionTo: 'credit-settings',
        }
      : {
          tone: 'warning',
          icon: '⚠',
          title: 'La configuración de crédito está incompleta.',
          body: 'Pídele al dueño que la revise.',
        }
  }
  if (code === 'BUSINESS_LEGAL_DATA_MISSING') {
    return canConfigureCredit(role)
      ? {
          tone: 'warning',
          icon: '⚠',
          title: 'Falta el RNC o la dirección del negocio.',
          body: 'El contrato los necesita. Complétalos para poder vender.',
          actionLabel: 'Completar datos del negocio',
          actionTo: 'credit-settings',
        }
      : {
          tone: 'warning',
          icon: '⚠',
          title: 'Falta el RNC o la dirección del negocio.',
          body: 'Pídele al dueño que los complete.',
        }
  }
  if (code === 'DOCUMENT_UNREADABLE') {
    return {
      tone: 'danger',
      icon: '✕',
      title: 'No pudimos leer el documento del cliente.',
      body: 'Revisa la ficha y vuelve a guardar el documento. Si sigue pasando, avísanos.',
      actionLabel: canEditClients(role) ? 'Editar ficha' : 'Ver ficha',
      actionTo: canEditClients(role) ? `/clientes/${clientId}/editar` : `/clientes/${clientId}`,
    }
  }
  if (code === 'DOCUMENT_UNREADABLE_GUARANTOR') {
    return {
      tone: 'danger',
      icon: '✕',
      title: 'No pudimos leer el documento de un garante.',
      body: 'Revisa los contactos del cliente y vuelve a guardarlo.',
      actionLabel: 'Ver ficha',
      actionTo: `/clientes/${clientId}`,
    }
  }
  if (code === 'LEGACY_SALE_LEGAL_DATA_MISSING') {
    return {
      tone: 'warning',
      icon: '⚠',
      title: 'Esta venta se registró sin RNC ni dirección del negocio.',
      body: 'Por eso no se puede generar su contrato.',
    }
  }
  if (code === 'SALE_ALREADY_VOIDED') {
    return {
      tone: 'warning',
      icon: '⚠',
      title: 'Esta venta ya estaba anulada.',
      body: '',
    }
  }
  if (code === 'SALE_HAS_PAYMENTS') {
    return {
      tone: 'warning',
      icon: '⚠',
      title: 'No se puede anular: la venta ya tiene pagos.',
      body: '',
    }
  }
  return {
    tone: 'danger',
    icon: '✕',
    title: GENERIC_SALE_ERROR,
    body: backendMessage && backendMessage !== GENERIC_SALE_ERROR ? backendMessage : '',
  }
}

export function simulatorWarningCopy(
  code: string,
  role: Role | null,
  clientId: string,
  backendMessage?: string,
): BannerCopy {
  if (code === 'settings_configured' || code === 'CREDIT_SETTINGS_MISSING') {
    return canConfigureCredit(role)
      ? {
          tone: 'warning',
          icon: '⚠',
          title: 'Estás simulando sin configuración de crédito.',
          body: 'El recargo sale en 0 %. Configura el crédito para poder registrar la venta.',
          actionLabel: 'Configurar crédito',
          actionTo: 'credit-settings',
        }
      : {
          tone: 'warning',
          icon: '⚠',
          title: 'Estás simulando sin configuración de crédito.',
          body: 'Pídele al dueño que configure el crédito.',
        }
  }
  if (code === 'client_blocked' || code === 'CLIENT_BLOCKED') {
    const reason = blockedReason(backendMessage)
    return {
      tone: 'danger',
      icon: '⛔',
      title: `Este cliente está bloqueado: ${reason}.`,
      body: 'No se le puede vender a crédito.',
      actionLabel: 'Ver ficha',
      actionTo: `/clientes/${clientId}`,
    }
  }
  if (code === 'legal_data_missing' || code === 'BUSINESS_LEGAL_DATA_MISSING') {
    return canConfigureCredit(role)
      ? {
          tone: 'warning',
          icon: '⚠',
          title: 'Falta el RNC o la dirección del negocio.',
          body: 'El contrato los necesita. Complétalos para poder vender.',
          actionLabel: 'Completar datos del negocio',
          actionTo: 'credit-settings',
        }
      : {
          tone: 'warning',
          icon: '⚠',
          title: 'Falta el RNC o la dirección del negocio.',
          body: 'Pídele al dueño que los complete.',
        }
  }
  if (code === 'collector_inactive') {
    return canConfigureCredit(role)
      ? {
          tone: 'warning',
          icon: '⚠',
          title: 'El cobrador de este cliente está inactivo.',
          body: 'Puedes vender, pero reasígnale un cobrador para poder cobrar.',
          actionLabel: 'Reasignar cobrador',
          actionTo: `/clientes/${clientId}/editar`,
        }
      : {
          tone: 'warning',
          icon: '⚠',
          title: 'El cobrador de este cliente está inactivo.',
          body: 'Puedes vender, pero avísale al dueño para que le asigne otro.',
        }
  }
  return {
    tone: 'warning',
    icon: '⚠',
    title: backendMessage?.trim() || GENERIC_SALE_ERROR,
    body: '',
  }
}

export function registeredCollectorWarning(
  role: Role | null,
  clientId: string,
): BannerCopy {
  return canConfigureCredit(role)
    ? {
        tone: 'warning',
        icon: '⚠',
        title: 'El cobrador de este cliente está inactivo.',
        body: 'Reasígnale un cobrador para poder cobrar esta venta.',
        actionLabel: 'Reasignar cobrador',
        actionTo: `/clientes/${clientId}/editar`,
      }
    : {
        tone: 'warning',
        icon: '⚠',
        title: 'El cobrador de este cliente está inactivo.',
        body: 'Avísale al dueño.',
      }
}

export function confirmBlockedReason(
  flags: {
    settingsMissing: boolean
    clientBlocked: boolean
    legalMissing: boolean
  },
  role: Role | null,
): string | null {
  if (flags.clientBlocked) return 'No se puede vender a un cliente bloqueado.'
  if (flags.settingsMissing) {
    return canConfigureCredit(role)
      ? 'Configura el crédito para confirmar.'
      : 'Pídele al dueño que configure el crédito.'
  }
  if (flags.legalMissing) {
    return canConfigureCredit(role)
      ? 'Completa el RNC y la dirección para confirmar.'
      : 'Pídele al dueño que los complete.'
  }
  return null
}

function blockedReason(message?: string): string {
  if (!message) return 'motivo no indicado'
  const prefix = 'Este cliente está bloqueado:'
  const trimmed = message.trim()
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trim().replace(/\.$/, '') || 'motivo no indicado'
  }
  return trimmed.replace(/\.$/, '')
}
