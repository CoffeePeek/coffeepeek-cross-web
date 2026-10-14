import { newHomeDraft, validateHomeDraft } from '../src/utils/homeCheckInForm';

const now = new Date(2026, 9, 14, 12, 0);

test('builds a private home check-in with local day and comma dose', () => {
  const draft = { ...newHomeDraft(now), date: '2026-10-14', time: '12:00', doseGrams: '18,50', minutes: '3', seconds: '5', customBeanName: 'Домашнее зерно' };
  const result = validateHomeDraft(draft, false, now);
  expect(result.errors).toEqual({});
  expect(result.request).toMatchObject({ preparedOn: '2026-10-14', doseGrams: 18.5, brewDurationSeconds: 185, customBeanName: 'Домашнее зерно', visibility: 'Private', photos: [], drinkPhoto: null });
});

test('rejects future time, two bean choices, invalid dose and duration together', () => {
  const draft = { ...newHomeDraft(now), date: '2026-10-15', time: '12:00', coffeeProductSlug: 'beans', customBeanName: 'Other', doseGrams: '18,123', minutes: '0', seconds: '0' };
  expect(validateHomeDraft(draft, false, now).errors).toEqual(expect.objectContaining({ date: expect.any(String), bean: expect.any(String), doseGrams: expect.any(String), duration: expect.any(String) }));
});

test('editing unknown visibility requires an explicit choice and never sends photos', () => {
  const draft = { ...newHomeDraft(now), date: '2026-10-14', time: '12:00', visibility: '' as const, coffeeProductId: 'saved-id' };
  expect(validateHomeDraft(draft, true, now).errors.visibility).toBeTruthy();
  const result = validateHomeDraft({ ...draft, visibility: 'Public' }, true, now);
  expect(result.request?.coffeeProductId).toBe('saved-id');
});
