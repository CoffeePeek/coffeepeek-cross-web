# PostHog analytics

The customer app sends product analytics to the EU PostHog project
[CoffeePeek / 306763](https://eu.posthog.com/project/306763).
The admin app is not instrumented. Existing Vercel Analytics and Speed Insights remain enabled.

For a standalone Russian specification and instructions for matching Android/iOS analytics,
see [PostHog mobile implementation](POSTHOG-MOBILE-IMPLEMENTATION.md).

## Configuration

Production configuration is in `.env.production`:

- `VITE_POSTHOG_KEY`: public browser project token (`phc_...`), not a personal API key.
- `VITE_POSTHOG_HOST`: `https://eu.i.posthog.com` for this project.
- `VITE_POSTHOG_ENABLE_DEV`: set to `true` only for deliberate local testing.
- Release context uses `VERCEL_GIT_COMMIT_SHA`, or build-time `APP_VERSION`, or a local build timestamp.

Vite embeds these values at build time. If Vercel defines these environment variables,
its values override the file; match them to this project and rebuild after changing them.
No personal API key or account credential belongs in a `VITE_*` variable.

For local development, copy the PostHog values into ignored `.env.local` and enable
`VITE_POSTHOG_ENABLE_DEV=true`. Without the key/host, or in development without that
flag, PostHog remains disabled. Production preview uses the production configuration.

## Consent and data

The SDK loads only after the visitor accepts the new analytics consent banner.
The previous hosting-metrics banner's acceptance does not enable PostHog.
Visitors can change their choice in the shared controls on
[`/privacy#analytics-settings`](https://coffeepeek.by/privacy#analytics-settings) or
[`/terms#analytics-settings`](https://coffeepeek.by/terms#analytics-settings); revocation disables
capture and clears the SDK identity. This choice applies to the current browser; mobile app
consent is managed separately. Consent is stored under `coffeepeek.analyticsConsent.v1`.

Signed-in visitors are identified by internal user ID, without name or email.
Logout and account changes reset the previous identity. Query strings and hashes
are removed from page, referrer and nested SDK URL properties before capture.
Marketing query parameters are not collected. No form values, review text, precise
coordinates or raw API payloads are explicitly sent.

Autocapture, session recording, automatic exception/stack capture, surveys and feature flags are disabled.
API and check-in failures send controlled categories and HTTP status, never error messages or bodies.
This is product diagnostics, not a replacement for backend logs or a stack-trace error tracker.

## Data deletion requests: operator procedure

Withdrawing consent in either legal page's analytics settings stops further capture and resets the local SDK identity;
it does not delete events already stored in PostHog. The `/profile/delete` flow sends an
email confirmation link before deleting the CoffeePeek account. This frontend does not
implement or establish an automatic PostHog purge as part of that flow.

For deletion of stored PostHog data, users can write to `info@coffeepeek.by` with the subject
`Удаление данных PostHog` and their account email or internal account ID. Handle requests as follows:

1. Verify the requester's identity using the existing account/support process. Never request a password.
2. Resolve the account email to its internal backend user ID within CoffeePeek; do not send the
   email to PostHog. Locate that ID and its linked distinct IDs in the EU project above. If account
   deletion is also requested, preserve only the identifiers needed to complete this lookup before
   removing the backend account.
3. For guest activity, an existing analytics distinct ID from the relevant browser or device may
   be needed. Explain any identification limitation if it is unavailable; do not attempt to identify
   the person through IP addresses or device fingerprinting.
4. Delete the matching person profile **and associated events**, including activity under its linked
   distinct IDs, through the authorized PostHog project interface or management API. Resetting the
   SDK, unlinking an ID, or deleting only profile properties is insufficient. For an API deletion,
   request event deletion explicitly with `delete_events=true`. A personal API key is an operator
   secret: use it only in a protected server-side environment, never in browser code or `VITE_*`.
5. Verify the deletion result and confirm it to the requester; explain any data that cannot be
   identified or any applicable legal retention exception. Do not promise that consent withdrawal
   recalls requests already sent or in flight.

The operator confirmed that the EU project uses PostHog's default retention. As of 15 October 2026,
the [pricing FAQ](https://posthog.com/pricing) guarantees retention of events and metadata for
one year on a free plan and seven years on a paid plan; older data may then be deleted. These are
provider guarantees, not scheduled deletion deadlines. The exact active tariff is not established
by this repository. Check the actual project and billing settings before stating a project-specific
period or changing the public policy. No deletion SLA has been independently verified.
Follow the current PostHog guidance on [data storage and deletion](https://posthog.com/docs/privacy/data-storage)
and [persons](https://posthog.com/docs/data/persons) when carrying out an authorized request.

## Common context and counting

Every explicit event includes `app=coffee-peek`, `event_schema_version=1`, `app_version`,
`environment`, `auth_state` (`guest`/`signed_in`) and a stable `page_type`.
The SDK supplies browser/device/session metadata. Selected `city_slug` appears on search events
only when it matches the city's public catalog; it is not inferred from precise device coordinates.

`feature_exposed` requires at least 10% visibility for 500 ms in an active tab. It is deduplicated
per route visit, feature and placement, including repeated cards/responsive copies. A feature
without IntersectionObserver support produces no exposure rather than a guessed impression.
Late consent only measures the currently visible feature. Exposure does not prove attention.

Events wait for consent and SDK readiness. The bounded in-memory startup queue holds up to 50
events only while analytics is enabled; account changes/revocation clear it. Capturing means
accepted by the SDK, not a delivery guarantee (network/ad blockers can still lose events).

## Events

| Event | When | Properties |
| --- | --- | --- |
| `$pageview` | First page and changes to the route pathname | Sanitized URL/path, common context |
| `feature_exposed` | Feature stays visibly on screen | `feature`, `placement` |
| `sign_in_completed` | Successful password or Google sign-in | `method`, `entry_point` |
| `sign_up_completed` | Successful password registration | `method` |
| `auth_gate_shown` | Unauthenticated action requires sign-in | `feature` |
| `catalog_search_started` | New search criteria, not pagination/refetch | `catalog`, `search_id`, `source`, `has_query`, capped `query_length`, `filter_keys`, `sort`, `nearby`, optional `city_slug` |
| `catalog_results_viewed` | Search settles with results (including zero) | Search context, `result_count`, `is_empty`, `duration_ms` |
| `catalog_search_failed` | Search settles with an error | Search context, safe failure category/status, `duration_ms` |
| `catalog_item_opened` | Result card or map popup clicked | `entity_type`, `source`, optional `search_id`, `position` |
| `filters_opened`, `filters_applied` | Filters opened/applied/reset | `catalog`, placement or active/changed filter names, `action` |
| `map_interaction` | Map expanded/collapsed/loaded/failed; marker, zone, zoom or nearby interaction | `action`, optional count/duration/enabled |
| `geolocation_result` | Location availability resolves | `placement`, `trigger`, `outcome`, optional duration; no coordinates |
| `entity_detail_viewed` | Shop/roaster/coffee successfully loaded | `entity_type`, incoming `entry_point`, optional `search_id` |
| `shop_content_interacted` | Photo/menu/hours/roasters interaction | `section`, `action` |
| `shop_action_clicked` | Directions/share/contact/check-in/edit/report clicked | `action`, `entry_point` |
| `entity_content_interacted` | Coffee/roaster content interacted with | `entity_type`, `section`, `action` |
| `favorite_attempted` | Favorite control clicked | `entity_type`, optional intended `is_favorite` |
| `favorite_changed` | Server confirms adding/removing a favorite | `entity_type`, `is_favorite`, `duration_ms`, `resumed_after_auth` |
| `favorite_failed` | Favorite change fails | `entity_type`, safe category/status, duration |
| `favorites_opened` | Saved shops opened from profile | `entry_point=profile` |
| `check_in_start_attempted` | Create entry clicked, before auth gate | `source` |
| `check_in_flow_started`, `check_in_kind_selected` | Flow starts/type chosen | Ephemeral `flow_id`, `source`, `kind`, `mode` |
| `check_in_step_viewed` | Actual visible picker/editor step | Flow context, `step`, `duration_ms` |
| `check_in_field_interacted` | First modification of a field in this flow | Flow context, field category only |
| `check_in_submit_attempted` | Save pressed | Flow context, `attempt`, elapsed duration |
| `check_in_validation_failed` | Client/server rejects fields | Flow context, controlled field categories, `validation_source`, `attempt` |
| `check_in_failed`, `check_in_retry_clicked` | Operation fails/is retried | Flow context, `stage`, attempt; failure category/status/duration |
| `check_in_saved` | Server confirms create OR edit | Flow context, attempt/duration, visibility, photo presence |
| `check_in_created` | Server confirms a NEW visit or home check-in | `kind`, `visibility`, `has_photos`, optional flow correlation/duration |
| `check_in_cancelled` | Explicit close/back/map exit | Flow context, `step`, `reason`, elapsed duration |
| `feed_viewed` | First feed page loaded | First-page `result_count`, `is_empty` |
| `feed_action_clicked` | Refresh/load-more/retry | `action`, `trigger` |
| `feed_item_interacted` | Post open/author/shop/photo/like/home detail interaction | `action`, `check_in_kind` |
| `api_request_completed` | Logical HTTP client request finishes | Controlled `category`, `method`, `outcome`, `duration_ms`, `status_code`, `auth_retried`, optional error category |
| `app_download_clicked` | Visitor clicks a download/store button | `channel` |

Search/filter query changes do not create duplicate pageviews. Session restoration
does not count as sign-in. Google sign-in does not claim registration because the
API does not distinguish new accounts. Download clicks are not installation counts.
Map directions and external links measure intent, not an actual visit. Likes, sharing and
contact actions measure attempts, not confirmed remote outcomes. `check_in_saved` includes
edits; use `check_in_created` for new activity. Field interactions are not completed steps.
Missing completion is funnel drop-off; only explicit closes emit cancellation.

The generic HTTP outcome includes token-refresh retry as ONE logical request, marked
`auth_retried=true`. Cancelled requests and stale responses after account changes are excluded.
React Query retries are separate requests, while catalog search deduplication is by criteria.
Background API calls count as diagnostics, not feature usage. Uploads made directly to object
storage are covered by check-in failure stages, not by the centralized HTTP metric.

## PostHog dashboard recipe

These are concrete definitions for the project's dashboards, not pre-created cloud objects.
The public browser project token can ingest events; managing saved insights requires a signed-in
PostHog session or management API access. Filter all reports to `environment=production`, exclude
`coffeepeek_integration_test` and local/preview traffic, and count unique people for adoption.

| Report | Definition / comparison |
| --- | --- |
| Feature reach | Unique people with `feature_exposed`, broken down by `feature` and `placement`, last 28 days |
| Exposure → use | Funnel: exposure of feature → corresponding action below, same session; also show absolute people counts |
| Search quality | `catalog_search_started` → `catalog_results_viewed` → `entity_detail_viewed`; hold `search_id` constant, breakdown by catalog/source/has_query/city; empty results divided by settled results |
| Search reliability | Searches failed / searches started; separate from zero-result rate and network latency |
| Map vs list | Successful `entity_detail_viewed`, breakdown by `entry_point`; compare exposure-to-open funnels for each source |
| Favorites | Exposure → `favorite_attempted` → `favorite_changed` with `is_favorite=true`; separately guest → auth gate → sign-in → resumed change; later `catalog_item_opened` with `source=favorites` |
| Check-in completion | `check_in_flow_started` → editor `check_in_step_viewed` → `check_in_submit_attempted` → `check_in_saved`, hold `flow_id` constant, filter `mode=create`; breakdown source and chosen kind |
| Check-in friction | Validation/failure counts by field/stage and attempt; median/p90 flow duration for completed flows; retry-to-save conversion |
| Feature repeat | Retention: use the same meaningful action as start and return, inspect 7-day and 28-day windows; repeat means a later session/day, not another click immediately |
| Product retention | Cohorts of first-time feature users vs users who were exposed but did not use it; compare return activity in days 1–7 and 1–28, with matched acquisition/time/auth context |
| Reliability | Failure rate and p50/p95 `duration_ms` for `api_request_completed`, grouped by category/method/app_version; separate auth retries |

Meaningful action mapping:

- Search/filter: settled search with `has_query=true` / `filters_applied(action=apply)`.
- Shops/coffees/roasters: `entity_detail_viewed` filtered by `entity_type`.
- Map: marker selection or a detail view with `entry_point=map`.
- Menu/photos/contacts/directions: corresponding section/action interaction.
- Favorites: confirmed add (`favorite_changed(is_favorite=true)`) and later saved-list opening.
- Visit/home diary: `check_in_created` split by `kind=visit/home`.
- Feed: `feed_item_interacted`, split by shop/home and action.

Global check-in flows begin with `kind=undecided`, then branch at `check_in_kind_selected`.
Do not filter the initial step to `kind=home/visit`, which would remove picker-origin flows.
For source-to-directions across several searches, use same-session time windows; action events
without `search_id` cannot prove that one particular earlier search caused the later action.

Only elapsed cohorts can support 7/28-day retention. Returning users and feature usage are
correlations, not proof of causal retention impact. Low reach suggests discoverability issues;
high attempts with low completion suggests friction; low broad adoption with strong repeat
in a small segment suggests a niche feature. None alone is a reason to delete a feature.
People who decline analytics and users blocked by browser/network are absent from these reports.

## Verification

1. Open the app in a fresh browser session. No PostHog requests should occur before consent.
2. Accept, navigate between pages, then check the project's Activity view for `$pageview`.
3. Verify the page URL contains no query/hash; attempts and server-confirmed results remain separate.
4. Disable analytics in `/privacy#analytics-settings` and verify subsequent navigation produces no
   captures. Verify the `/terms#analytics-settings` control reflects the same browser choice,
   including changes in another tab, and that each page's direct settings link reaches the control.
5. Check logout/account switching does not attach a new visitor to the old account.
6. Scroll past a feature briefly, then keep it visible: only the latter should produce an exposure.
7. Search, paginate and refocus: only changed criteria create a new search ID. Open a result
   and verify its detail-view event retains that ID and list/map/favorites source.
8. Create a visit/home check-in; trigger validation then retry. Verify one flow ID, increasing
   attempts, one confirmed created event; editing should produce saved but never created.
9. Verify a failed API response produces a category/status/duration without request/response contents.

`npm run typecheck`, `npm test`, and `npm run build` validate the integration locally.
