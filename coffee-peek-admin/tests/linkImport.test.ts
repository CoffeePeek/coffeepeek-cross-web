import { CONTACT_FIELDS, newCandidateFromLink, normalizeLinkImportUrl, selectedContactPatch, validateLinkImportDraft } from '../src/utils/linkImport';

const yandex = normalizeLinkImportUrl('https://yandex.by/maps/org/blasercafe/86729516416/?from=mapframe&ll=1,2&z=15');
const draft = { ...yandex, extractedAt: '', evidence: {}, fields: { name: 'Blasercafe', address: 'Минск, Немига, 5', latitude: 53.9, longitude: 27.55, phone: '+375 29 684-00-10', website: 'https://blasercafe.by', openingHours: 'Mo-Su 09:00-20:00' } };

describe('link import input and persistence', () => {
  test('normalizes organisation URL, strips map centre and tracking, requests Russian page', () => {
    expect(yandex).toEqual({ source: 'yandex', url: 'https://yandex.by/maps/org/86729516416/?lang=ru_RU', externalId: 'yandex:86729516416' });
    expect(normalizeLinkImportUrl('https://yandex.ru/maps/?oid=123').externalId).toBe('yandex:123');
    expect(normalizeLinkImportUrl('https://yandex.ru/maps/-/CHhAExample').externalId).toBeUndefined();
  });
  test('normalizes profile casing and ignores tracking', () => {
    expect(normalizeLinkImportUrl('https://instagram.com/BlaserCafe.by/?igsh=abc').url).toBe('https://www.instagram.com/blasercafe.by/');
  });
  test.each(['https://instagram.com.evil.test/coffee/', 'https://yandex.by.evil.test/maps/org/123/', 'http://instagram.com/coffee/', 'https://name:pass@instagram.com/coffee/', 'https://instagram.com:8000/coffee/', 'https://instagram.com/p/123/', 'https://instagram.com/accounts/', 'https://yandex.by/maps/?ll=27.55,53.9', 'javascript:alert(1)', 'file:///etc/passwd'])('rejects unsafe or unsupported URL %s', (url) => {
    expect(() => normalizeLinkImportUrl(url)).toThrow();
  });
  test('rejects another organisation and profile', () => {
    expect(() => validateLinkImportDraft({ ...draft, url: 'https://yandex.by/maps/org/999/' }, yandex)).toThrow('другая');
    expect(() => validateLinkImportDraft({ ...draft, url: 'https://instagram.com/coffee/' }, yandex)).toThrow('другая');
  });
  test('whitelists fields, strips unsafe URLs and invalid paired coordinates', () => {
    const result = validateLinkImportDraft({ ...draft, fields: { name: '  Blasercafe ', website: 'javascript:alert(1)', latitude: 91, longitude: 27, phone: '3 тыс. подписчиков', instagram: 'https://evil.test/coffee', unknown: 'ignored' } }, yandex);
    expect(result.fields).toEqual({ name: 'Blasercafe' });
  });
  test('requires an explicit selection for every contact and never sends identity changes through PATCH', () => {
    expect(selectedContactPatch(draft.fields, new Set(['name', 'address', 'openingHours']))).toEqual({ openingHours: 'Mo-Su 09:00-20:00' });
    expect(selectedContactPatch(draft.fields, new Set())).toEqual({});
  });
  test('preserves coordinates of the source organisation and sends no description, tags or publication', () => {
    const result = newCandidateFromLink({ ...draft, fields: { ...draft.fields, description: 'Bio' } }, new Set(['name', 'address', 'latitude', 'longitude', 'description', ...CONTACT_FIELDS]));
    expect(result).toEqual({ ...draft.fields, externalId: 'yandex:86729516416' });
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('tags');
  });
  test('requires real coordinates and identity fields for creation, with zero accepted as valid', () => {
    expect(() => newCandidateFromLink(draft, new Set(['name', 'address', 'latitude']))).toThrow('координаты');
    expect(newCandidateFromLink({ ...draft, fields: { ...draft.fields, latitude: 0, longitude: 0 } }, new Set(['name', 'address', 'latitude', 'longitude']))).toMatchObject({ latitude: 0, longitude: 0 });
  });
});
