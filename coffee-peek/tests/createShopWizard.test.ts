import { adjustShopTime, createShopDefaults, createShopSchema } from '../src/utils/createShopWizard';
import { buildShopSubmissionPayload } from '../src/utils/shopModerationForm';

const validForm = () => ({ ...createShopDefaults(), name: 'Coffee', cityId: 'minsk', notValidatedAddress: 'улица Некрасова, 10' });

describe('Coffee shop wizard validation and submission', () => {
  it('allows all optional steps to be skipped and omits empty contacts and catalogs', () => {
    const parsed = createShopSchema.parse(validForm());
    const payload = buildShopSubmissionPayload(parsed);
    expect(payload.shopContact).toBeUndefined();
    expect(payload.equipmentIds).toBeUndefined();
    expect(payload.priceRange).toBeUndefined();
    expect(payload.schedules).toHaveLength(7);
    expect(payload.schedules?.every((day) => day.openTime === '09:00' && day.closeTime === '21:00')).toBe(true);
  });

  it('requires name, address and city, including whitespace-only names and addresses', () => {
    const result = createShopSchema.safeParse({ ...validForm(), name: '  ', notValidatedAddress: ' ', cityId: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['name', 'notValidatedAddress', 'cityId']));
  });

  it('enforces the 55-character name limit and trims submitted fields', () => {
    expect(createShopSchema.safeParse({ ...validForm(), name: 'a'.repeat(56) }).success).toBe(false);
    expect(createShopSchema.parse({ ...validForm(), name: '  Coffee  ' }).name).toBe('Coffee');
  });

  it('accepts domains without a scheme and validates entered email and website', () => {
    const data = validForm();
    data.shopContact.website = 'mycoffee.by';
    data.shopContact.email = 'info@coffee.by';
    expect(createShopSchema.safeParse(data).success).toBe(true);
    data.shopContact.website = 'not a website';
    data.shopContact.email = 'invalid';
    const result = createShopSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining(['shopContact.website', 'shopContact.email']));
  });

  it('preserves selections, closed days and individual hours in the submission', () => {
    const data = { ...validForm(), priceRange: 'Moderate' as const, roasterIds: ['roaster-1'], brewMethodIds: ['method-1'], equipmentIds: ['machine-1'], coffeeBeanIds: ['bean-1'], schedules: [{ dayOfWeek: 0, openTime: '10:30', closeTime: '20:00' }] };
    const payload = buildShopSubmissionPayload(createShopSchema.parse(data));
    expect(payload.priceRange).toBe(2);
    expect(payload.roasterIds).toEqual(['roaster-1']);
    expect(payload.brewMethodIds).toEqual(['method-1']);
    expect(payload.equipmentIds).toEqual(['machine-1']);
    expect(payload.coffeeBeanIds).toEqual(['bean-1']);
    expect(payload.schedules).toEqual(data.schedules);
  });

  it('rejects missing days, invalid times and identical opening and closing times', () => {
    expect(createShopSchema.safeParse({ ...validForm(), schedules: [] }).success).toBe(false);
    for (const [openTime, closeTime] of [['', '21:00'], ['25:00', '21:00'], ['09:00', '09:00']]) {
      expect(createShopSchema.safeParse({ ...validForm(), schedules: [{ dayOfWeek: 0, openTime, closeTime }] }).success).toBe(false);
    }
  });

  it('supports hours that cross midnight', () => {
    expect(createShopSchema.safeParse({ ...validForm(), schedules: [{ dayOfWeek: 0, openTime: '22:00', closeTime: '02:00' }] }).success).toBe(true);
  });

  it('uses half-hour steps without wrapping across midnight', () => {
    expect(adjustShopTime('09:00', 30)).toBe('09:30');
    expect(adjustShopTime('09:00', -30)).toBe('08:30');
    expect(adjustShopTime('23:30', 30)).toBe('23:59');
    expect(adjustShopTime('00:00', -30)).toBe('00:00');
  });

  it('creates independent defaults for each form', () => {
    const first = createShopDefaults();
    first.schedules[0].openTime = '10:00';
    first.roasterIds.push('roaster-1');
    const second = createShopDefaults();
    expect(second.schedules[0].openTime).toBe('09:00');
    expect(second.roasterIds).toEqual([]);
  });
});
