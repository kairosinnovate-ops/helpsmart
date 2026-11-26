# Architecture

## Overview

```
 Browser (web)            Future mobile apps
     │  session cookie          │  Firebase ID token (Bearer)
     ▼                          ▼
 ┌──────────────────── Next.js on Firebase App Hosting ────────────────────┐
 │ proxy.ts        optimistic redirect for signed-out users (not security) │
 │ Server components   read through src/server/services                    │
 │ Route handlers  /api/v1 (users), /api/admin (staff), /api/identity,      │
 │                 /api/webhooks   → mutation()/query() wrappers            │
 │                   origin check · body cap · zod validation · errors     │
 │ src/server/auth     session → user doc → role/permission guards         │
 │ src/server/services accounts, providers, bookings, requests, messaging, │
 │                     reviews, support, admin, notifications, reference   │
 │ src/server/identity IdentityProvider → Fayda OIDC RP | dev fixture       │
 │ src/server/payments PaymentGateway adapters (not configured)            │
 │ src/domain          pure rules shared by server and UI                  │
 └──────────┬──────────────────────────────┬───────────────────────────────┘
            │ Admin SDK                    │ OIDC (discovery, token, JWKS, userinfo)
            ▼                              ▼
   Firestore · Storage · Auth        Fayda eSignet (after official onboarding)
            ▲
            │ triggers / schedule
   Cloud Functions: push notifications, housekeeping
```

## Principles

1. **Server owns every write.** Clients never write to Firestore. The rules deny all client writes. Every change goes through a route handler, which checks the session, the role and the input, and then uses the Admin SDK. This is how the app stops users changing their own verification, roles, approvals, badges, ratings, payment status or commission.
2. **Pure domain logic.** The booking state machine, money math, review rules, badge rules, ranking and permissions are plain TypeScript in `src/domain`. They have no I/O and are unit-tested. Mobile apps can reuse them.
3. **Fail closed.** If identity verification, a payment gateway or a map provider is not configured, the feature says it is unavailable. It never pretends to work.
4. **Data minimisation.** Identity data lives in separate collections that no client can read. It is encrypted, and only an allow-list of claims is kept.
5. **Projections for public data.** `publicProfiles/{uid}` is rebuilt by the server from private provider data. It exists only while the provider is approved, identity-verified and active. Badges are computed there from evidence, never set by hand.

## Request lifecycle (mutation)

1. `mutation(handler)` checks that `Origin` matches the app (CSRF), caps the body at 64 KB and parses JSON.
2. The handler calls a guard: `requireUser`, `requireVerifiedUser`, `requireProvider` or `requireAdmin(permission)`.
3. The service validates the input with zod, runs the change (in a transaction where state matters), writes an audit entry and creates notifications.
4. `handle()` maps `ApiError`, `ZodError` and booking-transition errors to JSON responses with stable codes.

## Identity verification flow

1. `POST /api/identity/start`: the user must give consent, and is rate limited. The server creates a consent record and a one-time session whose document id is `sha256(state)`. The nonce and PKCE verifier are stored encrypted. The server returns the provider's authorization URL.
2. The user authenticates with Fayda. HelpSmart never sees or stores the OTP or biometrics.
3. `GET /api/identity/callback`: the session is consumed once in a transaction, so a replayed callback is rejected. The callback must arrive in the same signed-in account. The code is exchanged with `private_key_jwt` and PKCE. The ID token signature, `iss`, `aud`, `azp`, `exp` and `nonce` are checked. Signed or encrypted userinfo is verified, and `sub` must match.
4. The subject is stored only as `HMAC(issuer|sub)` in `identitySubjects`. If that subject is already linked to another account, the user goes to `additional_review` instead of being verified.
5. Only allow-listed claims are kept, encrypted, in `privateIdentityRecords`. FIN/FAN, photos and biometrics are never kept.

All endpoints come from the issuer's discovery document. No Fayda URL, client ID or key is in the code.

## Booking lifecycle

`draft → awaiting_provider_response | awaiting_quote → awaiting_customer_confirmation → confirmed → provider_en_route → in_progress → completed`, with `cancelled`, `disputed`, `refund_pending` and `refunded` branches. Transitions and the actors allowed for each one are defined in `src/domain/booking.ts`. The server re-checks every transition in a Firestore transaction. The exact address is shown to the provider only once the booking is confirmed.

## Payments

In the MVP, HelpSmart records payments; it does not process them. For cash and bank transfer, both the customer and the provider confirm in the app. Only then is the payment marked paid and ledger entries (`transactions`) written. Gateway adapters report "not configured". The webhook endpoint verifies signatures, is idempotent per event id and logs mismatches to `reconciliationIssues`. HelpSmart does not hold customer funds (no escrow or wallet) until a licensed partner arrangement exists.

## Internationalisation

Catalogues live in `src/messages/*.json`. Server components use `getT()`; client components use `useT()`. A missing key falls back to English. The locale is stored in the `hs_locale` cookie and on the user profile. Dates are shown in the Africa/Addis_Ababa time zone. Amharic text is a draft and needs native-speaker review.

## Scaling notes

- Search loads up to 500 candidates per city and ranks them in memory. At scale, switch to geohash-prefix range queries (geohashes are already stored), or to a search service.
- Admin metrics use Firestore count and sum aggregations. Move to BigQuery export for history and dashboards.
- Rate limits use Firestore fixed windows. Move to Redis or Cloud Armor when traffic grows.
