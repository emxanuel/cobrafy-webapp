import type { AuditRead } from '@/features/audit/services/types'
import type { Role } from '@/features/auth/services/types'
import { ROLE_LABEL } from '@/features/shared/lib/roles'
import { maskDocument } from '@/features/shared/lib/mask-document'

export const ENTITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'client', label: 'Clientes' },
  { value: 'contact', label: 'Contactos' },
  { value: 'membership', label: 'Equipo' },
  { value: 'business', label: 'Negocio' },
  { value: 'credit_settings', label: 'Crédito' },
] as const

export const ENTITY_BADGE: Record<string, string> = {
  client: 'Cliente',
  contact: 'Contacto',
  membership: 'Equipo',
  business: 'Negocio',
  user: 'Usuario',
  invitation: 'Invitación',
  credit_settings: 'Crédito',
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Estado',
  blocked_reason: 'Motivo',
  collector_membership_id: 'Cobrador',
  document: 'Documento',
  phone: 'Teléfono',
  name: 'Nombre',
  address: 'Dirección',
  notes: 'Notas',
  role: 'Rol',
  is_active: 'Activo',
  email: 'Correo',
  doc_type: 'Tipo de documento',
  surcharge_kind: 'Tipo de recargo',
  surcharge_percent: 'Recargo (%)',
  surcharge_amount: 'Recargo fijo',
  allowed_frequencies: 'Frecuencias permitidas',
  max_installments: 'Máximo de cuotas',
  min_down_payment_percent: 'Inicial mínima (%)',
  interest_method: 'Método de cálculo',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  blocked: 'Bloqueado',
}

const CREDIT_ENUM_LABELS: Record<string, string> = {
  recargo_fijo: 'Recargo fijo',
  percent_of_financed: 'Porcentaje del financiado',
  fixed_amount: 'Monto fijo (RD$)',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

export function entityBadgeLabel(entity: string): string {
  return ENTITY_BADGE[entity] ?? entity
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function hasField(record: Record<string, unknown> | null, field: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, field))
}

const ACTION_TITLES: Record<string, string> = {
  login: 'Inicio de sesión',
  login_failed: 'Intento de entrada fallido',
  select_business: 'Cambio de negocio',
  pin_change: 'Cambio de clave rápida',
  pin_unlock: 'Desbloqueo con clave rápida',
  pin_failed: 'Clave rápida incorrecta',
  accept: 'Invitación aceptada',
  revoke: 'Invitación anulada',
}

export function auditActionTitle(event: AuditRead): string {
  if (ACTION_TITLES[event.action]) return ACTION_TITLES[event.action]
  if (event.action === 'block') return 'Cliente bloqueado'
  if (event.action === 'unblock') return 'Cliente desbloqueado'
  if (event.entity === 'client' && event.action === 'update') {
    if (hasField(event.before, 'collector_membership_id') || hasField(event.after, 'collector_membership_id')) {
      return hasField(event.before, 'collector_membership_id') && event.before?.collector_membership_id
        ? 'Cobrador reasignado'
        : 'Cobrador asignado'
    }
    return 'Cliente editado'
  }
  if (event.entity === 'client' && event.action === 'create') return 'Cliente creado'
  if (event.entity === 'contact' && event.action === 'create') return 'Contacto creado'
  if (event.entity === 'contact' && event.action === 'update') return 'Contacto editado'
  if (event.entity === 'contact' && event.action === 'deactivate') return 'Contacto desactivado'
  if (event.entity === 'membership' && event.action === 'update') return 'Equipo actualizado'
  if (event.entity === 'membership' && event.action === 'create') return 'Miembro agregado'
  if (event.entity === 'business' && event.action === 'update') return 'Negocio editado'
  if (event.entity === 'credit_settings' && event.action === 'create') {
    return 'Configuración de crédito creada'
  }
  if (event.entity === 'credit_settings' && event.action === 'update') {
    return 'Configuración de crédito editada'
  }
  if (event.action === 'create') return 'Registro creado'
  if (event.action === 'update') return 'Registro editado'
  if (event.action === 'deactivate') return 'Registro desactivado'
  return event.action
}

export function changedFields(event: AuditRead): string[] {
  const keys = new Set([
    ...Object.keys(event.before ?? {}),
    ...Object.keys(event.after ?? {}),
  ])
  return [...keys]
}

function isRole(value: string): value is Role {
  return value === 'dueño' || value === 'cajero' || value === 'cobrador'
}

export function formatAuditValue(
  field: string,
  value: unknown,
  namesById: Map<string, string>,
): string {
  if (value == null || value === '') return '—'
  if (field === 'document' && typeof value === 'string') return maskDocument(value)
  if (field === 'collector_membership_id' && typeof value === 'string') {
    return namesById.get(value) ?? 'Cobrador'
  }
  if (field === 'status' && typeof value === 'string') {
    return STATUS_LABELS[value] ?? value
  }
  if (field === 'role' && typeof value === 'string' && isRole(value)) {
    return ROLE_LABEL[value]
  }
  if (field === 'doc_type' && value === 'cedula') return 'Cédula'
  if (field === 'doc_type' && value === 'pasaporte') return 'Pasaporte'
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAuditValue(field, item, namesById))
      .join(', ')
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string') return CREDIT_ENUM_LABELS[value] ?? value
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

export function dateToAwareStart(date: string): string {
  return `${date}T00:00:00-04:00`
}

export function dateToAwareEnd(date: string): string {
  return `${date}T23:59:59.999-04:00`
}
