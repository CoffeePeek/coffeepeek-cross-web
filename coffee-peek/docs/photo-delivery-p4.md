# P4: protected check-in variants in the customer web app

Companion to CoffeePeek/coffeepeek-backend PRs #346–#349. The admin app is unchanged.

Gallery cards choose ready feed variants by displayed physical size, preserve the server order and load at most four visible tiles. Offscreen tiles do not fetch; the fifth gallery photo is not prefetched. The viewer loads only its current detail image, with a separate original action. Drink cutouts use thumb/detail and keep transparent formats. WebP is preferred, with ready PNG/JPEG alternatives if decoding fails. Legacy responses without a variants field keep the original URL. An explicit empty/unsupported manifest shows a placeholder and still permits opening the original explicitly in the viewer.

Protected bytes continue through the central authenticated HTTP client. No bearer token is attached to a foreign origin and redirects are rejected. Fetch uses no-store; no Service Worker, Cache API, persistent blob cache, or conditional 304 reuse is added. Four transfers may run at once; concurrent requests for the same session/URL share only in-flight work. The last subscriber cancels its request.

Each visible image holds its object URL only for its current display. It is released offscreen, on unmount, on URL/account/session changes, on local check-in mutations and before a new display authorization. Active displays reauthorize within 20 seconds from the start of their request; slow responses past that window are discarded. Browser visibility/focus also discards the previous resource. An error or offline request does not retain the previous blob. The conservative no-store behavior is intentional; keep backend positive caching disabled pending the real client/proxy acceptance matrix.

Validation:

```sh
npm test -- --runInBand
npm run typecheck
npm run build
```

Synthetic browser fixture: start the Vite server and open `/tests/photo-delivery.html`. This fixture replaces only the image transport with local synthetic SVG bytes, records requested URLs and exposes permission/session controls. It never requests real accounts, photographs or production endpoints. Check four feed requests (no fifth/original), current detail navigation, explicit original, deny/recover, session change, unmount/remount and an offline/error after the 20-second display window. The fixture is not part of the production entrypoint.

On this Windows nested checkout Jest needed a temporary runner using the existing config with `testRegex: "\\.test\\.ts$"` instead of root-prefixed testMatch. No test selection was reduced.

Remaining release gates: real Gateway/Caddy with anonymous, owner-only, hidden/deleted and blocked authors; logout/account switch and expired credentials; Chrome and Safari, including background/resume; corrupt/alpha/EXIF cases; and cold/warm download/decode/render measurements at 5 Mbit/s, 100 ms RTT. The synthetic UI fixture does not prove backend authorization or the end-to-end 60-second revocation limit. No production flags or deployment are changed.
