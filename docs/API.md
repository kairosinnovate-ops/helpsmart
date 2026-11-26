# API reference

JSON over HTTPS. The web app authenticates with the `__session` cookie (httpOnly, SameSite=Lax). Mobile clients send `Authorization: Bearer <Firebase ID token>`.

**Conventions**

- Success: `200 {"data": …}`. Error: `4xx/5xx {"error": {"code": "…", "message": "…"}}`. Codes are stable; messages are for people.
- Mutations require an `Origin` header that matches `APP_BASE_URL` (`bad_origin` otherwise). Bodies are capped at 64 KB.
- Validation errors return `400` with `code: "invalid_input"` and the zod issue paths.
- Money is integer santim (`amountMinor`). Times are ISO 8601 with offset on input, epoch milliseconds on output.
- **Guards:** `user` = signed in and active; `verified` = user with a verified identity (development fixture counts only in development); `provider` = user with the provider role; `admin:<permission>` = staff with that permission (see `src/domain/permissions.ts`).

## Auth and identity

| Method and path | Guard | Purpose |
|---|---|---|
| `POST /api/auth/session` | Firebase ID token in body (`idToken`), signed in within 5 minutes | Create the session cookie |
| `DELETE /api/auth/session` | any | Revoke refresh tokens and clear the cookie |
| `POST /api/identity/start` | user | `{consent: true}` → `{redirectUrl}`. `503 identity_provider_unavailable` when Fayda is not configured |
| `GET /api/identity/callback` | session cookie | Provider redirect target. Redirects to `/account/verify?result=verified|cancelled|failed|additional_review|expired_session|replay|unavailable` |

## Account (`/api/v1`)

| Method and path | Guard | Body |
|---|---|---|
| `POST /account` | user | Create profile after sign-up: `accountType`, `displayName`, `phone`, `locale`, `acceptTerms`, `acceptPrivacy`, `providerType?` |
| `PATCH /account` | user | `displayName?`, `phone?`, `locale?`, `subCityId?`, `neighborhoodId?`, `preferredCategoryIds?` |
| `POST /account/become-provider` | user | `providerType` |
| `POST /account/addresses`, `DELETE /account/addresses?id=` | user | Saved address |
| `POST /account/deletion` | user | `reason`; opens a deletion request for staff |
| `POST /notifications/read` | user | `ids?` (all when omitted) |
| `POST /support`, `POST /reports` | user | Support ticket; safety or misconduct report |
| `POST /blocks` | user | `uid`, `block` |

## Marketplace

| Method and path | Guard | Purpose |
|---|---|---|
| `GET /providers?category=&subCity=&neighborhood=&sort=&availableNow=&minRating=&maxPrice=&lang=&type=&verifiedQualifications=&page=` | public | Search approved, verified providers |
| `POST /providers/saved` | user | `providerId`, `save` |
| `POST /bookings` | verified | Create a booking (see `CreateBookingInput` in `src/server/services/bookings.ts`) → booking id |
| `POST /bookings/{id}/transition` | verified, party to booking | `action`, `note?`, `quote?` (for `submit_quote`). `409 invalid_state` / `403 forbidden_actor` |
| `POST /bookings/{id}/payment` | verified, party | Confirm a cash or bank-transfer payment. Paid only after both sides confirm |
| `POST /bookings/{id}/review` | verified, customer | `ratings` (6 dimensions, 1–5), `comment` |
| `POST /bookings/{id}/feedback` | verified, provider | Private feedback about the customer |
| `POST /requests` | verified | Post a service request for quotes |
| `POST /requests/{id}/quotes` | verified provider | Quote on an open request |
| `POST /requests/{id}/close` | verified, owner | Close a request |
| `POST /quotes/{id}/accept` | verified, request owner | Accept a quote → confirmed booking |
| `POST /conversations` | verified | `otherUid`, `bookingId?` → conversation id (providers cannot start cold conversations) |
| `POST /conversations/{id}/messages` | verified participant | `text` (rate limited; links flagged) |
| `POST /conversations/{id}/read` | participant | Mark read |
| `POST /reviews/{id}/respond` | provider | Public response to a review |
| `POST /reviews/{id}/report` | user | Report a review |

## HelpSmart Pro (`/api/v1/pro`)

| Method and path | Guard | Purpose |
|---|---|---|
| `PUT /pro/profile/{profile|categories|area|pricing|availability}` | provider | Save an onboarding section |
| `POST /pro/references` | provider | Add a reference |
| `POST /pro/credentials` | provider | Record an uploaded credential (`storagePath` must be under `credentials/{uid}/`) |
| `POST /pro/submit` | provider | Submit the application for review |
| `POST /pro/availability` | provider | `availableNow` toggle |

## Admin (`/api/admin`)

| Method and path | Permission | Purpose |
|---|---|---|
| `POST /applications/{uid}` | `providers.approve` | `decision`: `start_review`, `approve` (requires verified identity), `reject`, `request_info`, `suspend`, `reinstate` |
| `POST /credentials/{id}`, `POST /references/{id}` | `credentials.verify` | `status`: `verified` or `rejected` |
| `POST /identity/{uid}` | `identity.review_exception` | Resolve `additional_review`. Confirming needs an existing validated verification record; staff cannot create a verification |
| `POST /users/{uid}` | `users.suspend` / `users.delete` | Suspend, reinstate, process deletion |
| `POST /bookings/{id}` | `bookings.intervene` (+ `finance.refund` for refunds) | Cancel, resolve disputes, mark refunds |
| `POST /reviews/{id}` | `reviews.moderate` | Hide or restore a review (aggregates adjust) |
| `POST /cases/{collection}/{id}` | depends on collection | Resolve support tickets, reports, disputes |
| `PUT /categories` | `categories.manage` | Create or update a category |
| `PATCH /settings` | `settings.manage` | Commission, fees, feature flags |
| `GET /finance/export` | `finance.export` | CSV of ledger entries (audited) |

Every admin action writes an `auditLogs` entry.

## Webhooks

`POST /api/webhooks/payments/{gateway}` returns `503` until that gateway is configured. Once it is configured, the request must carry a valid signature. Events are processed once per `eventId`. Amount or booking mismatches go to `reconciliationIssues` and do not change the payment.
