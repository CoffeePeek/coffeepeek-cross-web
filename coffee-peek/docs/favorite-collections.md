# Shared favorite collections

`/collections/:id` is an anonymous, unlisted public page. It reads only
`GET /api/v1/favorite-collections/{id}` without an Authorization header. Membership
comes from the backend snapshot; it never imports or changes a viewer's
favorites. Cards open existing public shop/roaster details. Browser sharing uses
the canonical CoffeePeek link, with clipboard fallback and normal cancellation.
Shops precede a separate roaster block. Shop cards show current public rating and
check-in count when supplied; roaster logos use a compact white frame with contain
scaling. Sorting does not mutate the API cache input or alternate the two kinds.

The existing public-page server renderer supplies readable cards and Open Graph
metadata before JavaScript. It escapes server text, constructs local navigation
from validated kinds/slugs, accepts only HTTPS image URLs, emits `noindex,
nofollow` and uses `Cache-Control: no-store`. React Query retains no unused page
cache and refetches on mount/focus so revoked links are rechecked. Previously
downloaded images or a page already open offline cannot be recalled.

Analytics keeps the existing consent and identity rules. Collection IDs are
replaced by a stable group in explicit and SDK-added URL properties, including
the Vercel analytics/performance callbacks. No collection title or membership is
sent as a new analytics property. Existing shared profile CSS provides theme
colors and responsive cards.

## Validation — 2026-11-02

- Collection API + existing analytics contracts: 30 Jest tests passed, no failures.
- Server-rendered public routes/associated-domain contracts: 53 Node tests passed.
- Both TypeScript configurations and the production build passed. Existing Vite
  chunk-size warnings remain; no dependency or lockfile change was needed.
- Fixtures cover anonymous requests, invalid IDs, revoked links, escaped text,
  safe navigation/images and collection identifier removal from analytics. No
  production account, backend write or analytics event was used.

Reference-design update, 2026-11-03: 5 collection API/order tests and all 54
server-rendered/link tests passed. TypeScript and production build passed; no
browser/device visual review is implied by those checks.

Manual browser review of the new page (both themes, narrow/large windows, error
and empty states, keyboard navigation), browser share/cancel, messenger previews
and installed-app links remain acceptance gates. Screenshots must use synthetic
data and remain local. Apply the backend collection migration and deploy its API
before exposing links from the mobile release; this branch does not deploy the
backend. Verify associated-domain behavior with both updated and older installed
apps before release.

## Production rollout — 2026-11-03

The user requested server and website publication. Backend PR #376 is merged;
the standard deployment applies the additive collection migration before host
restart. Its PostgreSQL CI passed eight populated-schema upgrade cases.

Keep `/collections/*` out of the iOS association file until a released iOS app
handles it. The published app currently lacks that route; adding the path now
could divert a recipient into an app that cannot show the collection. Collection
links remain readable on the website. Other associated paths are unchanged.

The browser review attempted with synthetic read-only data could not run: the
in-app browser could not reach localhost, and Windows browser automation stopped
because URL policy enforcement is unsupported. No visual review is claimed.
Use HTTP/SSR/contract checks for this rollout; device/browser share, typography
and installed-app acceptance remain separate gates.
