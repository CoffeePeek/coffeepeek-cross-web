# Shared favorite collections

`/collections/:id` is an anonymous, unlisted public page. It reads only
`GET /api/v1/favorite-collections/{id}` without an Authorization header. Membership
comes from the backend snapshot; it never imports or changes a viewer's
favorites. Cards open existing public shop/roaster details. Browser sharing uses
the canonical CoffeePeek link, with clipboard fallback and normal cancellation.

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

Manual browser review of the new page (both themes, narrow/large windows, error
and empty states, keyboard navigation), browser share/cancel, messenger previews
and installed-app links remain acceptance gates. Screenshots must use synthetic
data and remain local. Apply the backend collection migration and deploy its API
before exposing links from the mobile release; this branch does not deploy the
backend. Verify associated-domain behavior with both updated and older installed
apps before release.
