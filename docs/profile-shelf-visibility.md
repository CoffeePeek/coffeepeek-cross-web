# Opt-in public profile shelf

The public profile reads `/api/v1/profiles/{slug}/shelf` through the existing
HTTP client and account-scoped React Query key. The owner manages visibility in
the mobile app. Hidden `data:null`, errors and in-flight refreshes render no
shelf, so previously fetched cards are not retained while visibility refreshes.

Only whitelisted public card fields are retained. Photos require HTTPS on the
configured API origin and the exact profile/bag/UUID proxy path; private shelf
paths, external URLs, credentials, queries and fragments are rejected. Coffee
links are constructed from safe catalog slugs. The compact horizontal shelf
uses the existing profile styles and COFFEEPEEK placeholder. Collection section
headings use the selected collection title, with “Избранное” as fallback.

Server-rendered public pages use the same public read contract, no-store reads,
HTML escaping, guarded image paths and safe coffee destinations. Blocked profile
responses do not trigger collection/shelf reads. No private shelf API, owner
management or global-favorites fallback is introduced.

API and Node SSR regressions cover hidden/error paths, explicit field projection,
order, cancellation, unsafe URLs, escaping and blocked profiles. The HTTP client
now accepts an optional cache policy, exercised against actual fetch options;
public shelf reads use no-store without changing other request defaults.

Verification on 2026-11-04: 463 Jest cases and 65 Node SSR cases passed, zero
failures/skips; both application/node TypeScript projects passed; production
build passed (existing Vite large-chunk warning remains); design:check passed.
The first typecheck correctly rejected cache on the previous typed get config;
that original failure log is retained beside the rerun logs in backend
`artifacts/profile-shelf`. No automated UI tests were added or run. Manual
responsive/theme/accessibility review and deployed API acceptance remain gates;
this branch is not deployed by these checks.
