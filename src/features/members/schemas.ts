import { z } from 'zod'

export const inviteSchema = z.object({
  email: z.email('Escribe un correo válido.'),
  role: z.enum(['cashier', 'collector']),
})

export type InviteFormValues = z.infer<typeof inviteSchema>
