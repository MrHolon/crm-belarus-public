import { z } from 'zod';

const taskPriority = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Client-side validation for creating a task (B1).
 * Mirrors DB: tasks.priority enum, complexity 1–5, required category/type.
 */
export const taskCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Укажите название')
    .max(500, 'Не более 500 символов'),
  description: z.string().max(20000).optional().nullable(),
  category_id: z
    .number()
    .int()
    .refine((n) => n > 0, 'Выберите категорию'),
  task_type_id: z
    .number()
    .int()
    .refine((n) => n > 0, 'Выберите тип задачи'),
  priority: taskPriority,
  assignee_id: z.string().uuid('Выберите исполнителя'),
  due_date: z.union([z.string(), z.null()]).optional(),
  complexity: z.number().int().min(1).max(5),
  tagNames: z.array(z.string().min(1).max(64)).max(30),
  parent_task_id: z.number().int().positive().nullable().optional(),
});

export type TaskCreateFormValues = z.infer<typeof taskCreateSchema>;

/**
 * Редактирование уже созданной задачи (см. `canEditTask`).
 * Исполнитель здесь **не меняется** намеренно — это отдельный сценарий
 * (reassign после отклонения), у которого свои триггеры уведомлений.
 */
export const taskEditSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Укажите название')
    .max(500, 'Не более 500 символов'),
  description: z.string().max(20000).optional().nullable(),
  category_id: z
    .number()
    .int()
    .refine((n) => n > 0, 'Выберите категорию'),
  task_type_id: z
    .number()
    .int()
    .refine((n) => n > 0, 'Выберите тип задачи'),
  priority: taskPriority,
  complexity: z.number().int().min(1).max(5),
  due_date: z.union([z.string(), z.null()]).optional(),
  tagNames: z.array(z.string().min(1).max(64)).max(30),
});

export type TaskEditValues = z.infer<typeof taskEditSchema>;

/** B7: reject task as assignee (ТЗ §4.4 — минимум 10 символов). */
export const taskRejectReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Укажите причину не короче 10 символов')
    .max(4000),
});

export type TaskRejectReasonValues = z.infer<typeof taskRejectReasonSchema>;

/** B10: отмена задачи (ТЗ + триггер — минимум 5 символов). */
export const taskCancelReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Укажите причину не короче 5 символов')
    .max(4000),
});

export type TaskCancelReasonValues = z.infer<typeof taskCancelReasonSchema>;

/** D1: сохранение текущей задачи как шаблона. */
export const saveTaskTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Укажите название шаблона')
    .max(200, 'Не более 200 символов'),
  description_template: z.string().max(20000).optional().nullable(),
  is_public: z.boolean(),
});

export type SaveTaskTemplateValues = z.infer<typeof saveTaskTemplateSchema>;

/** D3: редактирование шаблона на странице /templates. */
export const taskTemplateEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Укажите название')
    .max(200, 'Не более 200 символов'),
  title_template: z
    .string()
    .trim()
    .min(1, 'Укажите заголовок по умолчанию')
    .max(500, 'Не более 500 символов'),
  description_template: z.string().max(20000).optional().nullable(),
  category_id: z.number().int().refine((n) => n > 0, 'Выберите категорию'),
  task_type_id: z.number().int().refine((n) => n > 0, 'Выберите тип задачи'),
  priority: taskPriority,
  complexity: z.number().int().min(1).max(5),
  default_tags: z.array(z.string().min(1).max(64)).max(30),
  is_public: z.boolean(),
});

export type TaskTemplateEditValues = z.infer<typeof taskTemplateEditSchema>;
