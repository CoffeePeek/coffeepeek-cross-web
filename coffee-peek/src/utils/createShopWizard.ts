import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Укажите время в формате ЧЧ:ММ');
const optionalEmail = z.string().trim().refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Укажите корректный email',
);
const optionalWebsite = z.string().trim().refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !/\s/.test(value);
  } catch {
    return false;
  }
}, 'Укажите корректный адрес сайта');

export const createShopSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название кофейни').max(55, 'Название не должно превышать 55 символов'),
  description: z.string(),
  cityId: z.string().min(1, 'Выберите город'),
  notValidatedAddress: z.string().trim().min(1, 'Укажите адрес'),
  priceRange: z.enum(['Cheap', 'Moderate', 'Expensive']).optional(),
  shopContact: z.object({
    phone: z.string().trim(),
    instagram: z.string().trim(),
    website: optionalWebsite,
    email: optionalEmail,
  }),
  equipmentIds: z.array(z.string()),
  coffeeBeanIds: z.array(z.string()),
  roasterIds: z.array(z.string()),
  brewMethodIds: z.array(z.string()),
  schedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: time,
    closeTime: time,
  }).refine((schedule) => schedule.openTime !== schedule.closeTime, {
    message: 'Время открытия и закрытия должно различаться',
    path: ['closeTime'],
  })).min(1, 'Выберите хотя бы один рабочий день'),
});

export type CreateShopFormValues = z.infer<typeof createShopSchema>;

export function createShopDefaults(): CreateShopFormValues {
  return {
    name: '', description: '', cityId: '', notValidatedAddress: '',
    priceRange: undefined,
    shopContact: { phone: '', instagram: '', website: '', email: '' },
    equipmentIds: [], coffeeBeanIds: [], roasterIds: [], brewMethodIds: [],
    schedules: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek, openTime: '09:00', closeTime: '21:00',
    })),
  };
}

/** Half-hour controls stop at midnight rather than wrapping into another day. */
export function adjustShopTime(value: string, delta: number): string {
  const [hours, minutes] = value.split(':').map(Number);
  const total = Math.max(0, Math.min(1439, hours * 60 + minutes + delta));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
