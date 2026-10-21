import { customNotificationSchema, notificationTemplateSchema, renderNotificationPreview } from '../src/utils/notificationTemplates';

test('automatic templates validate placeholders and expanded length', () => {
  const form = { title: 'Решение: {status}', body: 'Проверка {subject} завершена' };
  expect(notificationTemplateSchema('Moderation').safeParse(form).success).toBe(true);
  expect(renderNotificationPreview(form, 'Moderation')).toEqual({ title: 'Решение: одобрено', body: 'Проверка чекина завершена' });
  expect(notificationTemplateSchema('Moderation').safeParse({ ...form, body: '{unknown}' }).success).toBe(false);
  expect(notificationTemplateSchema('Inactivity').safeParse(form).success).toBe(false);
  expect(notificationTemplateSchema('Moderation').safeParse({ ...form, title: 'x'.repeat(111) + '{subject}' }).success).toBe(false);
});

test('new shop templates preview names and reserve their maximum length', () => {
  const form = { title: 'Новая кофейня', body: 'На карте появилась «{name}»!' };
  expect(notificationTemplateSchema('NewShop').safeParse(form).success).toBe(true);
  expect(renderNotificationPreview(form, 'NewShop').body).toBe('На карте появилась «Территория кофе»!');
  expect(notificationTemplateSchema('NewShop').safeParse({ ...form, body: '{status}' }).success).toBe(false);
  expect(notificationTemplateSchema('NewShop').safeParse({ ...form, title: '{name}' }).success).toBe(false);
  expect(notificationTemplateSchema('NewShop').safeParse({ ...form, body: 'x'.repeat(201) + '{name}' }).success).toBe(false);
});

test('custom messages require a recipient and retain literal text', () => {
  expect(customNotificationSchema.safeParse({ userId: 'invalid', title: 'Title', body: 'Body' }).success).toBe(false);
  expect(renderNotificationPreview({ title: 'Custom', body: '{literal text}' }).body).toBe('{literal text}');
});
