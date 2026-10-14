import { z } from 'zod'

export const inviteSchema = z.object({
  email: z.email('Escribe un correo válido.'),
  role: z.enum(['cajero', 'cobrador']),
})

export type InviteFormValues = z.infer<typeof inviteSchema>
