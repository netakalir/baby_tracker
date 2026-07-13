import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'צריך להזין כתובת אימייל')
  .email('כתובת האימייל לא תקינה')

export const passwordSchema = z
  .string()
  .min(6, 'הסיסמה חייבת להכיל לפחות 6 תווים')

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'צריך להזין סיסמה'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'צריך לאשר את הסיסמה'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'הסיסמאות לא תואמות',
    path: ['confirmPassword'],
  })

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
