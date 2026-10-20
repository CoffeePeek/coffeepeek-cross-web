# Notification UI

Admin: System → Уведомления (`/notifications`), Admin role only. The user list's
“Уведомление” action prefills the recipient ID. Custom messages have title/body limits
120/500 and a device-style preview. Once submitted the payload is frozen: a network
failure retries the same UUID and content. Queue acceptance does not prove delivery.
“Новое сообщение” starts a fresh message after success.

Automatic Moderation and Inactivity templates are loaded from the Account API and
saved independently. Moderation supports `{subject}` and `{status}`; the preview uses
чекина/одобрено. Inactivity has no variables. Unknown variables or expanded text over
the limits are rejected. Editing only changes newly queued messages. The default reminder
is “Время для кофе?” / “Давно не виделись! Загляните в CoffeePeek и поделитесь новым чекином.”
Inactivity means seven days without visits AND check-ins, repeated at most weekly.

Customer: signed-in Settings has moderation, reminder and custom switches. Changes
apply to all connected mobile installations. The app reports visible visits and
15-minute foreground heartbeats. Reminders default off. OS permission is managed
separately by each Android/iOS app. Browser push registration is not implemented.

API: GET/PUT `/api/v1/me/notifications/preferences`, POST `/activity` under the same
root; GET `/api/admin/notifications/templates`, PUT `/templates/{Moderation|Inactivity}`
under that admin root, and PUT `/api/admin/notifications/{uuid}` for a custom message.
The full backend contract is docs/api/push-notifications.md in CoffeePeek-NET.

Verified: both production builds/type checks, template validation tests and a DOM test
that edits/previews/saves a template, sends a custom message and retries without changing
its ID or payload. The editor was also inspected in a local browser with isolated fixture
responses; this does not validate delivery or production Firebase configuration.

On 2026-10-20, the actual local admin was also tested against Gateway/Account/PostgreSQL:
sign-in, loading both automatic templates, saving the moderation template and sending
two custom messages to the isolated Android test app on a Pixel 9. Both were accepted
by FCM on attempt one and appeared in Android's notification list (open/background
app). The owner confirmed seeing the first. This validates the local flow; production
deployment and iOS/APNs setup are separate remaining steps.
