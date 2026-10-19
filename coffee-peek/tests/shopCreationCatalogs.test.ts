jest.mock('../src/api/core/apiConfig', () => {
  // Keep the real endpoint definitions; only replace Vite's build-time environment for Jest.
  const ts = require('typescript');
  const source = require('fs').readFileSync(require.resolve('../src/api/core/apiConfig'), 'utf8')
    .replaceAll('import.meta.env', '({ DEV: false, VITE_API_URL: "https://api.example" })');
  const config = {};
  new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(config);
  return config;
});
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/utils/errorHandler', () => ({ getErrorMessageByStatus: (status: number) => `HTTP ${status}` }));
jest.mock('../src/lib/analytics', () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock('../src/realtime/forceLogout', () => ({ emitSessionInvalidated: jest.fn() }));

import { getCities, getEquipments, getCoffeeBeans, getRoasters, getBrewMethods } from '../src/api/coffeeshop';
import { sendCoffeeShopToModeration } from '../src/api/moderation';
import { createShopDefaults } from '../src/utils/createShopWizard';
import { buildShopSubmissionPayload } from '../src/utils/shopModerationForm';

const originalFetch = globalThis.fetch;
const headers = { 'Content-Type': 'application/json' };
const address = (slug: string, kind: string) => ({ slug, canonicalPath: `/${kind}/${slug}`, revision: 1, isAlias: false });
afterEach(() => { globalThis.fetch = originalFetch; });

test('shop creation loads the current public catalogs and submits their slug identities', async () => {
  const catalogs: Record<string, unknown> = {
    '/api/Catalogs/cities': [{ address: address('minsk', 'cities'), name: 'Минск' }],
    '/api/Catalogs/equipments': [{ slug: 'linea', name: 'Linea', brand: 'La Marzocco', model: 'Mini', category: 0 }],
    '/api/Catalogs/beans': [{ slug: 'arabica', name: 'Арабика' }],
    '/api/roasters': [{ address: address('roaster', 'roasters'), name: 'Обжарщик', photoUrl: null, coverPhoto: null }],
    '/api/Catalogs/brew-methods': [{ slug: 'v60', name: 'V60', category: 2 }],
  };
  let submission: Record<string, unknown> | undefined;
  globalThis.fetch = jest.fn(async (url, options) => {
    const path = new URL(String(url)).pathname;
    if (path === '/api/ModerationShops' && options?.method === 'POST') {
      submission = JSON.parse(String(options.body));
      return new Response(JSON.stringify({ isSuccess: true, data: { shopId: 'submission', status: 'Pending', isAddressValidated: true } }), { status: 201, headers });
    }
    return path in catalogs
      ? new Response(JSON.stringify({ isSuccess: true, data: catalogs[path] }), { headers })
      : new Response('', { status: 404 });
  });
  const responses = await Promise.all([getCities(), getEquipments(), getCoffeeBeans(), getRoasters(), getBrewMethods()]);
  const [cities, equipment, beans, roasters, methods] = responses.map(response => response.data);
  expect(responses.every(response => response.success)).toBe(true);
  expect(responses.map(response => response.data[0].id)).toEqual(['minsk', 'linea', 'arabica', 'roaster', 'v60']);
  await sendCoffeeShopToModeration(buildShopSubmissionPayload({
    ...createShopDefaults(), name: 'Coffee', notValidatedAddress: 'Улица, 1', cityId: cities[0].id,
    equipmentIds: [equipment[0].id], coffeeBeanIds: [beans[0].id], roasterIds: [roasters[0].id], brewMethodIds: [methods[0].id],
  }));
  expect(submission).toMatchObject({ city: 'minsk', equipments: ['linea'], beans: ['arabica'], roasters: ['roaster'], brewMethods: ['v60'] });
  expect(submission).not.toHaveProperty('cityId');
});

test('empty equipment and bean catalogs remain successful empty lists', async () => {
  globalThis.fetch = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ isSuccess: true, data: [] }), { headers }));
  for (const load of [getEquipments, getCoffeeBeans]) {
    await expect(load()).resolves.toMatchObject({ success: true, data: [] });
  }
});
