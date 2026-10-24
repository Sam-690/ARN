import { z } from 'zod';

export const text = z.string().trim().min(1, 'Campo requerido').max(200);
export const positive = z.coerce
  .number()
  .finite()
  .positive()
  .max(100000000)
  .refine((n) => Math.abs(n * 10000 - Math.round(n * 10000)) < 0.001, 'Máximo 4 decimales');
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Fecha no válida',
  );
export const optionalText = z.string().trim().max(5000).default('');
export const projectSchema = z
  .object({
    code: text.max(24),
    name: text,
    client: text,
    location: text,
    manager: text,
    startDate: date,
    endDate: date,
  })
  .refine((v) => v.endDate >= v.startDate, 'La fecha final debe ser posterior a la inicial');
export const materialSchema = z.object({
  code: text.max(24),
  name: text,
  unit: text.max(16),
  type: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT']),
  price: positive,
});
export const componentSchema = z.object({ name: text, quantity: positive, price: positive });
export const budgetSchema = z.object({
  projectId: text,
  code: text.max(24),
  name: text,
  unit: text.max(16),
  quantity: positive,
  components: z.array(componentSchema).min(1).max(100),
});
export const orderSchema = z.object({
  projectId: text,
  supplier: text,
  expectedDate: date,
  lines: z
    .array(z.object({ materialId: text, quantity: positive, unitPrice: positive }))
    .min(1)
    .max(100),
});
export const logSchema = z.object({
  projectId: text,
  date: date,
  title: text,
  activities: z.string().trim().min(1).max(10000),
  incident: optionalText,
  crew: z.coerce.number().int().min(0).max(10000),
  weather: text.max(50),
  front: z.string().trim().max(200).default(''),
  budgetItemId: text.optional(),
});
export const includeOrder = {
  lines: { include: { material: true } },
  payments: true,
  project: true,
};
