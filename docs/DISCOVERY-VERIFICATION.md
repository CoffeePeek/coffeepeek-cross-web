# Discovery and coffee catalog verification — 2026-10-06

Contracts: OpenAPI 3.1 supplied in this task, plus [backend PR #334](https://github.com/CoffeePeek/coffeepeek-backend/pull/334) at `8a8bc274213404612e446fb46ae55fd45b8fa8a6` (`codex/coffee-catalog-daily-import`). Admin content/status/public-address/import DTOs were checked against its controllers and `CoffeeCatalogDtos.cs`.

## Live API

Read-only availability probes against `https://api.coffeepeek.by`:

| Request | Result |
| --- | --- |
| GET `/api/v1/catalogs/coffee-filter-values` | 404 |
| POST `/api/v1/discovery/search` | 404 |
| POST `/api/v1/coffee-shops/search` | 404 |
| POST `/api/v1/roasters/search` | 404 |
| POST `/api/v1/coffees/search` | 404 |
| POST `/api/v1/coffees/facets` | 404 |
| POST `/api/v1/roasters/facets` | 404 |

POST bodies were `{}` without JWT. These establish availability only. No live admin writes or authenticated integration checks were performed. Full integration requires backend deployment and a test account. Mock checks do not verify backend matching/counting/normalization or database persistence across devices.

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

## Screenshots (mock data)

| Customer | Admin |
| --- | --- |
| [Desktop, light](screenshots/discovery/customer-desktop-light.png) | [Desktop](screenshots/discovery/admin-desktop.png) |
| [Mobile, light](screenshots/discovery/customer-mobile-light.png) | [Mobile, light](screenshots/discovery/admin-mobile.png) |
| [Mobile, dark](screenshots/discovery/customer-mobile-dark.png) | [Mobile, dark](screenshots/discovery/admin-mobile-dark.png) |

Final result: customer 145 tests; admin 50 tests; customer SSR 13 tests. Both typechecks and production builds pass. Browser mock smoke passes (request count varies with refetches).
