import { z } from 'zod'

export const createFamilySchema = z.object({
  name: z.string().trim().max(100, 'השם ארוך מדי').optional(),
})

export const joinFamilySchema = z.object({
  token: z.string().trim().min(1, 'צריך להזין קוד הזמנה'),
})

const todayIsoDate = new Date().toISOString().slice(0, 10)

export const addChildSchema = z.object({
  name: z.string().trim().min(1, 'צריך להזין שם'),
  birthDate: z
    .string()
    .min(1, 'צריך להזין תאריך לידה')
    .refine((value) => value <= todayIsoDate, 'תאריך הלידה לא יכול להיות בעתיד'),
})

export type CreateFamilyInput = z.infer<typeof createFamilySchema>
export type JoinFamilyInput = z.infer<typeof joinFamilySchema>
export type AddChildInput = z.infer<typeof addChildSchema>
