import { z } from 'zod'

const documentType = z.enum(['cedula', 'pasaporte'])

export const referenceSchema = z.object({
  name: z.string().min(1, 'Escribe el nombre.'),
  phone: z.string().min(1, 'Escribe el teléfono.'),
  relationship: z.string().min(1, '¿Quién es para el cliente?'),
})

export const guarantorSchema = z.object({
  first_name: z.string().min(1, 'Escribe el nombre.'),
  last_name: z.string().min(1, 'Escribe el apellido.'),
  document_type: documentType,
  document_number: z.string().min(1, 'Escribe el documento.'),
  phone: z.string().min(1, 'Escribe el teléfono.'),
  relationship: z.string().min(1, '¿Quién es para el cliente?'),
})

export const clientFormSchema = z.object({
  first_name: z.string().min(1, 'Escribe el nombre.'),
  last_name: z.string().min(1, 'Escribe el apellido.'),
  document_type: documentType,
  document_number: z.string().min(1, 'Escribe el documento.'),
  phone: z.string().min(1, 'Escribe el teléfono.'),
  email: z
    .string()
    .refine(
      (value) => value === '' || z.email().safeParse(value).success,
      'Escribe un correo válido.',
    ),
  address: z.string().optional(),
  notes: z.string().optional(),
  collector_id: z.string().optional().nullable(),
  references: z.array(referenceSchema),
  guarantors: z.array(guarantorSchema),
})

export type ClientFormValues = z.input<typeof clientFormSchema>

export const emptyClientForm = (): ClientFormValues => ({
  first_name: '',
  last_name: '',
  document_type: 'cedula',
  document_number: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  collector_id: '',
  references: [],
  guarantors: [],
})

export const blockSchema = z.object({
  reason: z.string().min(1, 'Di por qué se bloquea.'),
})

export type BlockFormValues = z.infer<typeof blockSchema>
