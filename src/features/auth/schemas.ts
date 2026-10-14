import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const pinUnlockSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'La clave rápida son 4 a 6 números.'),
})

export type PinUnlockFormValues = z.infer<typeof pinUnlockSchema>

export const pinSetupSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña actual.'),
  pin: z.string().regex(/^\d{4,6}$/, 'La clave rápida son 4 a 6 números.'),
})

export type PinSetupFormValues = z.infer<typeof pinSetupSchema>

export const acceptInviteSchema = z
  .object({
    name: z.string().min(1, 'Escribe tu nombre.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirm_password: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirm_password'],
  })

export type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>
