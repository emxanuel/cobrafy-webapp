import { z } from 'zod'

const docType = z.enum(['cedula', 'pasaporte'])

export const contactFormSchema = z.object({
  contact_id: z.string().optional(),
  type: z.enum(['referencia', 'garante']),
  name: z.string().min(1, 'Escribe el nombre.'),
  phone: z.string().min(1, 'Escribe el teléfono.'),
  relationship: z.string().min(1, '¿Quién es para el cliente?'),
  address: z.string().optional(),
  doc_type: z.union([z.enum(['cedula', 'pasaporte']), z.literal('')]).optional(),
  document: z.string().optional(),
})

export const contactEditSchema = contactFormSchema.omit({ type: true })
export type ContactEditValues = z.input<typeof contactEditSchema>

export const clientFormSchema = z.object({
  name: z.string().min(1, 'Escribe el nombre.'),
  doc_type: docType,
  document: z.string().min(1, 'Escribe el documento.'),
  phone: z.string().min(1, 'Escribe el teléfono.'),
  address: z.string().min(1, 'Escribe la dirección.'),
  notes: z.string().optional(),
  collector_membership_id: z.string().optional().nullable(),
  contacts: z.array(contactFormSchema),
})

export type ClientFormValues = z.input<typeof clientFormSchema>

export const emptyClientForm = (): ClientFormValues => ({
  name: '',
  doc_type: 'cedula',
  document: '',
  phone: '',
  address: '',
  notes: '',
  collector_membership_id: '',
  contacts: [],
})

export const blockSchema = z.object({
  reason: z.string().min(1, 'Di por qué.'),
})

export type BlockFormValues = z.infer<typeof blockSchema>
