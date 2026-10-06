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
| POST `/api/v1/roasters/search` | 200; 22 roasters |
| POST `/api/v1/coffees/search` | 200; 0 published coffee, including availableOnly=false |
| POST `/api/v1/coffees/facets` | 200; selected zero-count values preserved |
| POST `/api/v1/roasters/facets` | 200; service AND and coffee.* groups |
| GET `/api/v1/favorites`, admin dictionaries/coffees/import runs without JWT | 401 |
| GET non-existent v1 coffee detail | 404 NOT_FOUND |

`npm run test:discovery-live` inside admin performs 38 real API checks and a customer browser smoke. It verifies scopes, wrong-group/unknown values, invalid price/currency/weight/range, empty relevance, missing geo origin, forbidden nested roasters, overlapping tags/excludeTags, independent budgets/pages and JWT requirements. API responses are not mocked. The browser verifies discovery/roasters/coffee, restored shops, the original map, mobile filters and reload, 375 px width and light/dark themes, and all 22 roasters through scroll loading. A transient 502 during the next-page request retains the first page and exposes Retry.

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
- Four main navigation items in the requested order with cup/factory/bean/map icons; no duplicate catalog navigation, coffee hero or sort selectors; no roaster search box. Coffee search reuses the full-width shop search bar.
- Restored shop quick filters, city default, 12-item infinite paging, nearby distance ordering without a fixed radius, invalid-code removal and mobile bottom sheet focus return. Tags fit one row with an exact +N remainder and adapt when card width changes.
- Roasters use the existing RoasterCatalogCard in a compact version of the reference layout: an uncropped square logo, title, address/about from cached details, a circular favorite button with a 26 px heart, two contract count tiles and a link to the filtered coffee catalog. The visible heading, result counter, filter panel and mobile filter control were removed following the latest request. Scroll loads subsequent pages, retains existing cards on failure and retries the failed page.
- Roaster card colors reuse the existing theme and brand tokens. Light cards have stronger outlines, soft statistic surfaces, neutral statistic icons and plain catalog action text, with a small gold arrow accent; dark cards use goldWarm. Browser checks found no colors outside the token palette and a minimum text contrast of 4.52:1 in light and 5.69:1 in dark.
- Coffee uses scroll loading without page controls or a visible result counter. A new search starts at page 1 and replaces the previous cards. Its empty state reuses the shop Mascot and message; active filter chips above the list are removed.
- Coffee filters reuse FilterAccordion and OptionRow from ShopFilterPanel, including count badges, checkmarks, selected tint, keyboard focus and 44 px option rows. Zero-count options remain selectable. The shop roaster filter displays circular source logos (initials when no image is supplied).
- List shows 250 g matchingOffers only; details include 100 g, RUB and Unknown. Unsafe purchase links are absent. Visible search 400/401/503 and detail 404.
- Coffee filters auto-apply after 350 ms, batch quick edits and reject invalid prices. Mobile panels stay open, selections survive closing, and URL/reload restoration works at 375 px in both themes.
- Guest favorite intent survives login; favorites survive reload; 503 rolls back; logout A → login B has an empty B favorites-only result. Controlled unit promises cover old A responses arriving after B starts.
- Admin tag create/deactivate/reactivate; GUID assignment replacement/reload/empty PUT via 204.
- Content → classification → variant → Published PATCH uses versions 7/8/9/10, preserving separate protection lists. 409 retains draft and requires comparison/explicit retry. Archive/restoration to Draft works.
- Declining the unsaved navigation prompt keeps the editor/draft. Moderator edits coffee and does not see Admin slug controls.
- Journal displays Applied/Failed by source; no import/rollback controls.

The original MapPage has no source changes relative to the pre-PR state. Live browser smoke verifies its map canvas, tiles, shop carousel and controls at 375 px. Geolocation permission denial was not exercised; existing distance/geolocation/bounds tests pass.

## Contract limitation

Admin coffee DTO exposes slug but no address revision read endpoint for Draft/Archived. Slug editing uses public v1 detail `address.revision` after publication and sends `expectedRevision`; it does not guess unpublished revision. A missing address is initialized with revision 0. The editor explains this limitation. Backend admin metadata reading is needed to rename an existing unpublished address safely.

## Customer design

The coffee hero, preset panel, sort selector, result counter and active filter chips were removed following the latest request. Search uses the full-width ShopSearchBar from the shop list. Coffee cards reuse ShopCard with the same rounded surface, 16:9 image area, title and hover/focus treatment. The existing RoasterCatalogCard uses a compact version of the supplied reference: flat surface, 12 px padding, 64 px uncropped square logo, 20 px title, address and two-line about text. The favorite control stays in its own grid column with a 44 px target and 26 px heart. The list uses one column on mobile, two from 768 px and three from 1180 px. Two tiles read coffeeShopsCount (visible shops) and coffeeProductsCount (published coffee positions, excluding pack variants) from the list DTO or cached detail DTO. Numeric strings are supported; zero, missing and invalid counts display a dash, without deriving values from shops.length or availableCoffeeProducts. The catalog link selects the roaster with availableOnly=false to include all published coffee. No new UI component or dependency was added. Coffee prices remain grouped by exact weight and currency. Cards show matchingOffers only, with other offers on detail pages. Keyboard Enter opens a card; nested details and coffee cards do not trigger their parent card. The coffee empty state matches the shop list using the existing search Mascot and message.

The shop list restores the pre-PR layout using the existing ShopSearchBar, ShopFilterPanel, ShopCard, skeletons, Mascot and useLoadMoreOnScroll. Desktop has the original quick filters and sidebar; mobile uses the original bottom sheet with native dialog focus handling. Searches still use the v1 server filters, auth scope and 12-item infinite pages. City defaults to the saved setting or first catalog city. Filter changes reset pagination, and invalid saved codes can be removed explicitly. No new UI component files were added.

The main public navigation is exactly «Кофейни · Обжарщики · Кофе · Карта», with cup, factory, bean and map icons from the installed icon library. The duplicate catalog navigation and sort selectors were removed. Roasters have no visible page heading, text search, filter panel, result counter or pagination controls; their grid fills the content width. Both roasters and coffee reuse useLoadMoreOnScroll and React Query to load further server pages. Background refresh and next-page loading do not add visible status text to these grids. A semantic visually hidden heading remains for accessibility.

Coffee filters follow [Apple HIG toggle guidance](https://developer.apple.com/design/human-interface-guidelines/toggles) using the existing shop filter primitives. Selection is visible through a checkmark and tint, keyboard focus has a ring, and rows provide at least 44 px hit areas. The grouped rounded panel matches the shop sidebar. Native selects and numeric inputs retain Zod validation; changes auto-apply after 350 ms, with no Apply/Reset buttons. Geolocation failure uses the existing toast and hides Nearby in every shop filter panel. The skill checker passes the targeted 44×44 size and primary/secondary text contrast pairs in both themes (17.49, 13.91, 7.63 and 10.19); this is not a full-site accessibility certification. No new UI components or dependencies were introduced.

The current public DTO has no Q score, body, archive total, drip/limited-edition filter or coffee favorite kind. Those reference elements are not simulated with invented data or inert controls. Supported filters stay available; the card action opens real purchase variants. No dependencies were added.

## Customer icons

The supplied Phosphor map is applied through the existing AppIcon/Icon adapters. Tags use the mobile slug mapping, including both plant-based-milk spellings and ListStar for unknown values. Settings/equipment, reviews, roasters, walking distance, generic navigation and calendar symbols follow the table. Edit sections and contribution entries share one icon map; favorite states use regular/fill hearts.

All seven supplied SVGs are copied unchanged into public/icons/brew-methods. CSS masks use currentColor in both themes. Deployed names Hario V60 and Cezve (Turkish Coffee) resolve to the supplied V60/Cezve assets; Moka Pot keeps the coffee fallback because no asset was supplied. The same icons appear in shop filters, details and creation/edit forms. No component files or dependencies were added.

Runnable icon tests cover asset existence/aliases, safe unknown/prototype fallbacks and accessible decorative/labeled semantics. Browser checks load all seven assets (200), assert 24 px filter icons and both theme colors, select by keyboard, retain the one-row +N tag layout, and verify the exact submitted tag IDs on mock API. The shop wizard displays all seven icons and preserves checkbox state. Live verification makes only read requests.

[Icons, light](screenshots/discovery/customer-icons-light.png), [icons, dark](screenshots/discovery/customer-icons-dark.png), [creation form](screenshots/discovery/customer-icons-wizard.png).

## Screenshots (mock data)

| Customer | Admin |
| --- | --- |
| [Desktop, light](screenshots/discovery/customer-desktop-light.png) | [Desktop](screenshots/discovery/admin-desktop.png) |
| [Mobile, light](screenshots/discovery/customer-mobile-light.png) | [Mobile, light](screenshots/discovery/admin-mobile.png) |
| [Mobile, dark](screenshots/discovery/customer-mobile-dark.png) | [Mobile, dark](screenshots/discovery/admin-mobile-dark.png) |

Live screenshots: [desktop](screenshots/discovery/customer-live-desktop.png), [mobile light](screenshots/discovery/customer-live-mobile.png), [mobile dark](screenshots/discovery/customer-live-mobile-dark.png). The empty coffee catalog is real API data.

Restored shop list: [desktop, live](screenshots/discovery/customer-shops-live-desktop.png), [mobile filters, live](screenshots/discovery/customer-shops-live-mobile-filters.png). Original [map, mobile, live](screenshots/discovery/customer-map-live-mobile.png). Native list behavior on mock: [desktop](screenshots/discovery/customer-shops-desktop.png), [mobile filters](screenshots/discovery/customer-shops-mobile-filters.png).

Roasters: [desktop, live](screenshots/discovery/customer-roasters-live-desktop.png), [mobile, live](screenshots/discovery/customer-roasters-live-mobile.png), [mobile dark, live](screenshots/discovery/customer-roasters-live-mobile-dark.png); mock [desktop](screenshots/discovery/customer-roasters-desktop.png), [mobile](screenshots/discovery/customer-roasters-mobile.png), [mobile dark](screenshots/discovery/customer-roasters-mobile-dark.png).

Final result: customer 150 tests; admin 52 tests; customer SSR 13 tests. Both typechecks and production builds pass. Browser mock smoke and live discovery checks pass (request count varies with refetches).
