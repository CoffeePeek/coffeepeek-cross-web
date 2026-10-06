# Discovery and coffee catalog verification — 2026-10-06

Contracts: OpenAPI 3.1 supplied in this task, plus [backend PR #334](https://github.com/CoffeePeek/coffeepeek-backend/pull/334). Initially checked at `8a8bc274213404612e446fb46ae55fd45b8fa8a6`; after deployment, rechecked at merged PR head `09e383e890f3596942f44176d33be09f9511da41` (merge commit `ebbc0434e7cdc1d82a3b208b939b5a90f9c35e0c`). Admin content/status/public-address/import DTOs were checked against its controllers and DTOs. The API does not expose its deployed commit, so these identify the reviewed contract rather than independently prove the deployed binary revision.

## Live API

After the deployment, read-only checks against `https://api.coffeepeek.by` pass. The earlier 404 availability result is superseded:

| Request | Result |
| --- | --- |
| GET `/api/v1/catalogs/coffee-filter-values` | 200; all 8 groups |
| GET `/api/v1/catalogs/roaster-tags` | 200 |
| POST `/api/v1/discovery/search` | 200; independent pages and null unselected section |
| POST `/api/v1/coffee-shops/search` | 200; 139 shops with city=minsk |
| POST `/api/v1/roasters/search` | 200; 20 roasters |
| POST `/api/v1/coffees/search` | 200; 0 published coffee, including availableOnly=false |
| POST `/api/v1/coffees/facets` | 200; selected zero-count values preserved |
| POST `/api/v1/roasters/facets` | 200; service AND and coffee.* groups |
| GET `/api/v1/favorites`, admin dictionaries/coffees/import runs without JWT | 401 |
| GET non-existent v1 coffee detail | 404 NOT_FOUND |

`npm run test:discovery-live` inside admin performs 37 real API checks and a customer browser smoke (15 real v1 responses in the recorded run). It verifies scopes, wrong-group/unknown values, invalid price/currency/weight/range, empty relevance, missing geo origin, forbidden nested roasters, overlapping tags/excludeTags, independent budgets/pages and JWT requirements. API responses are not mocked. The browser verifies discovery/roasters/coffee, mobile filters and reload, 375 px width and light/dark themes.

No published coffee is currently available: positive offer/detail/price-ordering and same-product AND scenarios therefore remain on the explicit mock. No live admin writes or authenticated favorites/admin integration checks were performed; those require a test account. Database persistence across devices is not established by mock checks.

Production CORS allows `https://coffeepeek.by`, while localhost preflights omit allow-origin. Customer development now uses the same `/backend` Vite proxy pattern as admin, forwarding to the absolute `VITE_API_URL` and rewriting refresh-cookie domain/path. Production still calls its configured API URL. For reproduction, start customer with `VITE_API_URL=https://api.coffeepeek.by`; use `COFFEE_CUSTOMER_ORIGIN` when its port differs from 5173. Generated live check details are in ignored `test-results/coffee-catalog/live-verification.json`.

## Local checks

- `npm ci` completed in both apps without dependency additions. npm audit reported existing findings: customer 43 (9 moderate, 34 high), admin 46 (10 moderate, 36 high).
- Customer: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:ssr`.
- Admin: `npm test`, `npm run typecheck`, `npm run build`, including the existing extension prebuild. Set `VITE_API_URL` for production builds.
- Unit checks cover URL restoration/scope validation, independent pages/budgets, currency+weight price requirements, matching offers, safe links, 204, kind+slug identity, concurrent rollback preservation, late A GET/PUT/DELETE including 401, late refresh/logout, complete content copying and sequential versions/409.
- Existing build warnings concern SignalR PURE annotations, large map chunks and customer ErrorPage import splitting.

## Browser smoke — explicit mock

Start both Vite apps on 5173/5174 and run `npm run test:coffee-catalog` inside admin. Installed Playwright Chromium intercepts API requests before any backend. Screenshots are generated under ignored `test-results/coffee-catalog/`. Optional origins: `COFFEE_CUSTOMER_ORIGIN`, `COFFEE_ADMIN_ORIGIN`.

Verified with synthetic OpenAPI/PR fixtures:

- Both discovery sections; empty shops with remaining roasters; independent pagination and browser Back.
- List shows 250 g matchingOffers only; details include 100 g, RUB and Unknown. Unsafe purchase links are absent. Visible search 400/401/503 and detail 404.
- Mobile draft Escape/discard/focus return, Apply, URL/reload restoration, 375 px without horizontal overflow and light/dark themes.
- Guest favorite intent survives login; favorites survive reload; 503 rolls back; logout A → login B has an empty B favorites-only result. Controlled unit promises cover old A responses arriving after B starts.
- Admin tag create/deactivate/reactivate; GUID assignment replacement/reload/empty PUT via 204.
- Content → classification → variant → Published PATCH uses versions 7/8/9/10, preserving separate protection lists. 409 retains draft and requires comparison/explicit retry. Archive/restoration to Draft works.
- Declining the unsaved navigation prompt keeps the editor/draft. Moderator edits coffee and does not see Admin slug controls.
- Journal displays Applied/Failed by source; no import/rollback controls.

Map routes/API calls remain available. Map tiles and permission denial were not manually exercised in this new smoke; existing distance/geolocation/bounds tests pass.

## Contract limitation

Admin coffee DTO exposes slug but no address revision read endpoint for Draft/Archived. Slug editing uses public v1 detail `address.revision` after publication and sends `expectedRevision`; it does not guess unpublished revision. A missing address is initialized with revision 0. The editor explains this limitation. Backend admin metadata reading is needed to rename an existing unpublished address safely.

## Customer design

The two supplied references are applied to `/coffees`: a spacious hero and count panel, pill presets, native sidebar accordions, three-column desktop cards, restrained borders/shadows, compact taste labels and exact-weight/currency prices. Mobile retains the draft/apply dialog and keyboard focus behavior. The count is the server product total for current criteria; cards show only matchingOffers and keep other offers on detail pages.

The current public DTO has no Q score, body, archive total, drip/limited-edition filter or coffee favorite kind. Those reference elements are not simulated with invented data or inert controls. Supported filters stay available; the card action opens real purchase variants. No dependencies were added.

## Screenshots (mock data)

| Customer | Admin |
| --- | --- |
| [Desktop, light](screenshots/discovery/customer-desktop-light.png) | [Desktop](screenshots/discovery/admin-desktop.png) |
| [Mobile, light](screenshots/discovery/customer-mobile-light.png) | [Mobile, light](screenshots/discovery/admin-mobile.png) |
| [Mobile, dark](screenshots/discovery/customer-mobile-dark.png) | [Mobile, dark](screenshots/discovery/admin-mobile-dark.png) |

Live screenshots: [desktop](screenshots/discovery/customer-live-desktop.png), [mobile light](screenshots/discovery/customer-live-mobile.png), [mobile dark](screenshots/discovery/customer-live-mobile-dark.png). The empty coffee catalog is real API data.

Final result: customer 146 tests; admin 50 tests; customer SSR 13 tests. Both typechecks and production builds pass. Browser mock smoke and live discovery checks pass (request count varies with refetches).
