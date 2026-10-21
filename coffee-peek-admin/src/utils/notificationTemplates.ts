import { z } from 'zod';
import type { NotificationMessage, TemplateCategory } from '../api/notifications';

export const notificationMessageSchema = z.object({
  title: z.string().trim().min(1, 'Введите заголовок').max(120, 'Не больше 120 символов'),
  body: z.string().trim().min(1, 'Введите текст').max(500, 'Не больше 500 символов'),
});
export const customNotificationSchema = notificationMessageSchema.extend({ userId: z.string().uuid('Укажите ID пользователя') });

export function renderNotificationPreview(message: NotificationMessage, category?: TemplateCategory): NotificationMessage {
  const render = (value: string) => category === 'Moderation'
    ? value.split('{subject}').join('чекина').split('{status}').join('одобрено')
    : category === 'NewShop' ? value.split('{name}').join('Территория кофе') : value;
  return { title: render(message.title), body: render(message.body) };
}

export const notificationTemplateSchema = (category: TemplateCategory) => notificationMessageSchema.superRefine((value, ctx) => {
  for (const field of ['title', 'body'] as const) {
    let rendered = value[field];
    if (category === 'Moderation') rendered = rendered.split('{subject}').join('исправления').split('{status}').join('не подтверждено');
    if (category === 'NewShop') rendered = rendered.split('{name}').join('я'.repeat(300));
    if (/[{}]/.test(rendered)) ctx.addIssue({ code: 'custom', path: [field], message: 'Неизвестная переменная шаблона' });
    if (rendered.length > (field === 'title' ? 120 : 500)) ctx.addIssue({ code: 'custom', path: [field], message: 'После подстановки переменных текст слишком длинный' });
  }
});
