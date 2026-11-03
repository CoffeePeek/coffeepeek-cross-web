# Editable saved collections — 2026-11-03

The mobile library owns editable public/private lists. Private means owner-only,
as explicitly confirmed by the user. Existing immutable collection snapshots and
their `/collections/:id` links remain supported; this website does not create or
modify the owner's lists or favorites.

The anonymous collection API adds `mode: snapshot|list`, `visibility: public`,
optional description, and a saved cover `{id,url}`. Library covers use the guarded
public stream on the configured API origin, not public object-storage addresses.
Business photo URLs retain their existing shape. React and server HTML reject
explicit private/unknown visibility and lists missing a public visibility value,
even if a malformed server response returned 200. Safe HTTPS cover paths,
escaped descriptions, empty public lists and old snapshots are supported.

Public profiles now read only `GET /api/v1/profiles/:slug/collection`, which returns
one explicitly featured public list or null. There is no fallback to all global
favorites. The existing favorites component remains available to its other owners,
but this public profile no longer mounts it. The profile and collection routes
do not retain inactive query data; focus/mount rereads reflect visibility changes.
Server HTML also reads the optional featured list and never requests favorites.
All HTML responses remain uncached. Existing consent/session analytics guards and
collection-identifier sanitization remain unchanged.

Verification covers anonymous credential omission, legacy snapshots, private and
unknown-visibility rejection, safe canonical paths, public-stream cover URLs,
escaped metadata, empty lists and profile featured/none behavior. Use unit/HTTP
contracts and normal TypeScript/build checks; do not add automated UI or screenshot
tests. Real account writes and production analytics are not used for verification.

Rollout order: deploy and verify the backend privacy/cover migrations and routes
before publishing this website or the new app flow. Confirm anonymous private
reads/streams fail and non-owner legacy favorites are closed. Mobile editor,
gallery, native share, accessibility and browser appearance require their own
manual gates. This branch does not deploy production changes.

Local verification on 2026-11-03, working patch based on website main `b2468b6`:
all 453 Jest contracts and 61 server-rendered/HTTP route cases passed, with zero
failures/skips. Both TypeScript projects and the production build passed. The
existing Vite large-chunk warning remains. No browser appearance, real account
mutation, production analytics or production deployment is claimed. This verifies
the agreed DTO against synthetic fixtures; coordinated live API acceptance remains
after the backend implementation and approved rollout.
