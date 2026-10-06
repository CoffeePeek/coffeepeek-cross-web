import { coffeeDraft, executeVersionedChanges, isVersionConflict } from '../src/utils/coffeeEditor';
import type { AdminCoffee, AdminClassification } from '../src/api/coffeeCatalog';
test('content, classification and variant writes use each successful product version', async () => {
  const versions: number[] = [];
  const committed: number[] = [];
  const changes = [1, 2, 3].map(() => async (version: number) => { versions.push(version); return { version: version + 1 }; });
  expect(await executeVersionedChanges(7, changes, value => committed.push(value.version))).toBe(10);
  expect(versions).toEqual([7, 8, 9]); expect(committed).toEqual([8, 9, 10]);
});
test('409 stops subsequent writes, keeps local draft and does not retry automatically', async () => {
  const conflict = Object.assign(new Error('changed'), { status: 409, errorCode: 'coffee_catalog_error' });
  const first = jest.fn(async () => ({ version: 8 }));
  const second = jest.fn(async () => { throw conflict; });
  const third = jest.fn(async () => ({ version: 10 }));
  const commits = jest.fn(); const draft = { name: 'my correction' };
  await expect(executeVersionedChanges(7, [first, second, third], commits)).rejects.toBe(conflict);
  expect(second).toHaveBeenCalledWith(8); expect(second).toHaveBeenCalledTimes(1); expect(third).not.toHaveBeenCalled(); expect(commits).toHaveBeenCalledWith({ version: 8 }); expect(draft.name).toBe('my correction'); expect(isVersionConflict(conflict)).toBe(true);
});
test('draft copies full server content and separates PascalCase/camelCase protections', () => {
  const coffee = { content: { name: 'Original', features: ['source fact'], unknownServerField: 'preserved' }, countries: [{ code: 'CO' }], protectedFields: ['Name', 'Countries', 'Photos'] } as unknown as AdminCoffee;
  const classification = { classification: { caffeine: null, composition: null, defaultBrewPurposes: [], tasteGroups: [] }, protectedFields: ['caffeine'], variants: [{ id: 'v', brewPurpose: null, protectFromImport: true }] } as unknown as AdminClassification;
  const draft = coffeeDraft(coffee, classification);
  draft.content.name = 'Correction'; draft.classificationProtected.push('acidity');
  expect(coffee.content.name).toBe('Original'); expect(draft.content).toHaveProperty('unknownServerField', 'preserved'); expect(draft.protectedFields).toEqual(['Name', 'Countries', 'Photos']); expect(classification.protectedFields).toEqual(['caffeine']); expect(draft.classification.caffeine).toBeNull(); expect(draft.variants[0].brewPurpose).toBeNull();
});
