/** 409 triples from services_sales.py + raise_conflict (field is always null). */
export const SALE_CONFLICTS = [
  {
    code: 'CLIENT_BLOCKED',
    field: null,
    message: 'Este cliente está bloqueado: Atraso de 3 cuotas',
  },
  {
    code: 'CREDIT_SETTINGS_MISSING',
    field: null,
    message: 'Configura el crédito del negocio antes de vender',
  },
  {
    code: 'CREDIT_SETTINGS_INCOMPLETE',
    field: null,
    message: 'La configuración de crédito del negocio está incompleta',
  },
  {
    code: 'BUSINESS_LEGAL_DATA_MISSING',
    field: null,
    message: 'Completa el RNC y la dirección del negocio antes de vender',
  },
  {
    code: 'DOCUMENT_UNREADABLE',
    field: null,
    message: 'No se pudo leer el documento del cliente',
  },
  {
    code: 'DOCUMENT_UNREADABLE_GUARANTOR',
    field: null,
    message: 'No se pudo leer el documento del garante',
  },
  {
    code: 'LEGACY_SALE_LEGAL_DATA_MISSING',
    field: null,
    message: 'La venta se registró sin RNC/dirección del negocio',
  },
  {
    code: 'SALE_ALREADY_VOIDED',
    field: null,
    message: 'Esta venta ya está anulada',
  },
  {
    code: 'SALE_HAS_PAYMENTS',
    field: null,
    message: 'No se puede anular una venta con pagos',
  },
] as const

export const COLLECTOR_INACTIVE_WARNING = {
  code: 'collector_inactive',
  message:
    'El cobrador asignado al cliente está inactivo; reasígnale un cobrador activo para que pueda cobrar esta venta.',
} as const

export const CLIENT_BLOCKED_WARNING = {
  code: 'client_blocked',
  message: 'Este cliente está bloqueado: Atraso de 3 cuotas',
} as const

export const LEGAL_DATA_MISSING_WARNING = {
  code: 'legal_data_missing',
  message: 'Completa el RNC y la dirección del negocio antes de vender',
} as const
