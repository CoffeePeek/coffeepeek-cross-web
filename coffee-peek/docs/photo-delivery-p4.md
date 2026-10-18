# P4: protected check-in variants in the customer web app

Companion to CoffeePeek/coffeepeek-backend PRs #346–#349. The admin app is unchanged.

Gallery cards choose ready feed variants by displayed physical size, preserve the server order and load at most three visible tiles. Offscreen tiles do not fetch; the remaining gallery photos are not prefetched. The viewer loads only its current detail image, with a separate original action. Drink cutouts use thumb/detail and keep transparent formats. WebP is preferred, with ready PNG/JPEG alternatives if decoding fails. Legacy responses without a variants field keep the original URL. An explicit empty/unsupported manifest shows a placeholder and still permits opening the original explicitly in the viewer.

Protected bytes continue through the central authenticated HTTP client, including token refresh and session checks. No bearer token is attached to a foreign origin, authorization is redacted in request logs and redirects are rejected. Fetch always uses `cache: no-store`; browser HTTP caches, Service Workers, Cache API and disk storage do not hold these bytes. Manual `If-None-Match` / 304 handling does not invoke JSON parsing. Four transfers may run at once; concurrent requests for the same session, full URL and source/recipe binding share in-flight work. The last subscriber cancels its request, including queued work.

`ProtectedPhotoCache` retains at most 64 encoded Blobs / 24 MiB in an LRU memory cache. Only ready manifest variants on the immutable check-in variant route qualify, with matching source, recipe, purpose, format and full URL. Originals, legacy URLs, home/private/moderation routes and `no-store` responses never enter this cache. A session generation identifies entries; bearer tokens do not appear in cache keys. Token changes, logout, account changes and local hide/delete/visibility mutations purge bytes and cancel pending responses. A late cancelled response cannot evict replacement bytes.

Byte retention and display permission are separate. Freshness uses RFC 9111 Date/Age and request-to-body-completion delay, capped at 20 seconds and JWT expiration. Both monotonic and wall deadlines are checked; rolling the wall clock back cannot extend authorization. Positive responses already stale at body completion fail closed. Missing/unreadable Date or malformed Age grants no fresh reuse. An online `max-age=0`/no-store response may satisfy its current display for at most 20 seconds from request start, capped by JWT expiration. Zero TTL may retain a validator solely for a future online request; an offline/error/denied response never falls back to retained bytes.

Expired bytes can be restored only by an authorized 304 matching the exact retained candidate, ETag and current session. Each 304 uses its own Cache-Control/Date/Age; an old server observation never starts another freshness window. A missing/mismatched ETag, missing cache policy or no-store 304 evicts the candidate and permits one unconditional retry. No anonymous fallback is allowed when current credentials are expired/malformed. Public anonymous requests remain supported in their own session generation.

Each active display creates and owns its object URL. It is revoked offscreen, on unmount, on URL/source/recipe/session changes, on invalidation and at permission expiry before reauthorization. A fresh byte hit reuses the existing authorization deadline, never extends it. Active displays check both clocks and current JWT at most one second apart, including visible-tab clock changes and suspend. Visibility/focus changes revoke displays and purge memory as an additional resume safeguard. Keep backend positive caching disabled until the real client/proxy acceptance matrix passes.

Validation:

```sh
npm test -- --runInBand
npm run typecheck
npm run build
```

Synthetic browser fixture: start the Vite server and open `/tests/photo-delivery.html?ttl=20` (or `?ttl=2` for quick expiration). It replaces only the central photo-response transport with local synthetic SVG bytes and records 200 / 304 / If-None-Match / denied / offline outcomes on actual variant routes. It never requests real accounts, photographs or production endpoints. Check three visible feed requests, warm Unmount/Mount without new requests, expiry followed by 304, detail navigation, explicit original (unconditional every display), deny after TTL, session purge, missing Date and no-store mode. The fixture is excluded from the production entrypoint. Jest adds fake-clock cases for Date/Age/delay, JWT and wall-clock changes, repeated stale 304, exact source/recipe/session binding, invalidation races, offline/revoked responses, LRU/byte bounds and last-subscriber cancellation.

The cache math follows [RFC 9111 section 4.2.3](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.2.3); application caps and failure behavior are intentionally conservative. The gateway must expose ETag, Date and Age through CORS (backend follow-up #350).

On this Windows nested checkout Jest needed a temporary runner using the existing config with `testRegex: "\\.test\\.ts$"` instead of root-prefixed testMatch. No test selection was reduced.

Remaining release gates: real Gateway/Caddy with anonymous, owner-only, hidden/deleted and blocked authors; logout/account switch and expired credentials; Chrome and Safari, including background/resume; corrupt/alpha/EXIF cases; and cold/warm download/decode/render measurements at 5 Mbit/s, 100 ms RTT. The synthetic UI fixture does not prove backend authorization or the end-to-end 60-second revocation limit. No production flags or deployment are changed.
