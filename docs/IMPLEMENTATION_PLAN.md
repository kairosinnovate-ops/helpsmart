# HelpSmart — Technical Implementation Plan (Phase One MVP)

Status: living document. Last updated 2026-11-26.

This plan turns the HelpSmart master specification into an executable Phase One build. It states what
is built now, what is deliberately deferred, and what is blocked on outside parties (Fayda relying-party
authorization, payment partner contracts, legal review).

## 1. Guiding decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | One Next.js (App Router) application serves the public site, the customer app, HelpSmart Pro and HelpSmart Admin, separated by route groups and role guards. | Spec §4 asks for one app in the MVP with a backend that can serve separate mobile apps later. |
| D2 | All privileged writes go through server code (Next.js route handlers under `/api/v1`) using the Firebase Admin SDK. Clients never write marketplace, identity, payment or rating data to Firestore directly. | Spec §32: users must never modify verification, roles, approvals, badges, ratings or payment status. Firestore rules deny client writes to those collections. |
| D3 | The API is plain JSON over HTTPS with Firebase session cookies (web) or Firebase ID tokens in `Authorization: Bearer` (future mobile apps). | Same backend serves Expo / native apps later without changes. |
| D4 | Domain logic (booking state machine, pricing and commission, review eligibility, rating aggregation, ranking, badge eligibility) lives in pure TypeScript modules under `src/domain` with unit tests. | Shared business logic can be lifted into a package for React Native. Easy to test. |
| D5 | Identity verification is a separate service (`src/server/identity`) behind an `IdentityProvider` interface. Fayda is implemented as a standards-based OIDC relying party (Authorization Code + PKCE, `private_key_jwt`, discovery from the configured issuer). No endpoint URLs or credentials are hard-coded. | Spec §7 and §11. Lets other countries plug in their own provider (Phase Four). |
| D6 | Fayda integration is fail-closed. Without complete configuration it refuses to start a verification. A development fixture provider exists only when `APP_ENV=development` and `IDENTITY_MODE=dev_fixture`; its results are stored with `source: "dev_fixture"`, never earn the Fayda Verified badge, and are rejected by every guard when `APP_ENV` is `staging` or `production`. | Spec §7, §38: production must not simulate identity. |
| D7 | Firestore is the system of record. Sensitive data is split into separate collections (`privateIdentityRecords`, `identityVerificationRecords`) that no client can read. Identity attributes are AES-256-GCM encrypted at the application layer, and the Fayda subject is stored only as an HMAC. | Spec §11, §31. |
| D8 | Location discovery uses region reference data (city → sub-city → neighbourhood with approximate centroids) plus geohashes on provider service areas. Distances are computed from neighbourhood centroids, never from a provider's exact home. | Spec §13: approximate proximity only. |
| D9 | Payments in the MVP are tracked, not processed. Cash and bank transfer are recorded with two-sided confirmation. Telebirr, CBE Birr and Chapa sit behind a `PaymentGateway` adapter that reports "not configured" until a licensed partner contract exists. Webhooks require signature verification and idempotency keys. | Spec §22: no unauthorised money holding, no simulated confirmations. |
| D10 | i18n uses JSON message catalogues per locale (en, am, om, ti, so) and a `t()` helper; UI text is never inlined in components. English is complete; other locales fall back to English key by key. | Spec §28. |
| D11 | Firebase Emulator Suite is the local and CI backend. Separate Firebase projects for dev, staging and production via `.firebaserc` aliases. | Spec §38. |
| D12 | Next.js 16 conventions: `proxy.ts` (formerly middleware) only does an optimistic redirect for signed-out users; real authorisation runs in every route handler and server component. | Proxy is not a security boundary. |

## 2. Milestones

| Milestone | Scope | Status |
|-----------|-------|--------|
| M1 Architecture | This plan, architecture doc, schema, security model, env templates | Done |
| M2 Design system | Tokens, typography, Button, Input, Card, Badge, Status pill, Skeleton, Empty state, Alert, Modal, Tabs, Table, nav shells | Done |
| M3 Public site | Landing page, how it works, become a helper, HelpSmart Family (coming soon), trust and safety, legal placeholders | Done |
| M4 Auth and identity | Email/password sign-up with email verification, +251 phone validation, session cookies, roles and custom claims, Fayda OIDC adapter, dev fixture provider, consent records, duplicate detection, audit logs | Done |
| M5 Marketplace | Dynamic categories, region data, provider onboarding wizard, public profiles, search, filters, sort, deterministic ranking | Done |
| M6 Bookings and comms | Booking lifecycle with server-validated transitions, quotations, open service requests, messaging (realtime reads), notifications, reviews with integrity rules | Done |
| M7 Admin | Executive metrics from real counts, user management, provider approvals, verification monitoring, categories, settings (commission), audit log, reports, disputes, support | Done |
| M8 Payments readiness | Payment model, gateway adapters, commission math, cash/bank tracking, webhook skeleton with signature + idempotency | Done |
| M9 Testing | Unit tests, Firestore rules tests, Fayda adapter negative tests against a local mock OP, API integration tests on emulators | Done |
| M10 Staging | Firebase App Hosting config, CI workflow, deployment guide | Config done; deploy needs a Firebase project and credentials |
| M11 Production readiness | Checklist in `docs/PRODUCTION_READINESS.md` | Blocked on external approvals |

## 3. Deferred to Phase Two or later (architecture prepared)

- Live payment gateways (adapters exist; need partner contracts and docs).
- Recurring bookings engine (data model `recurringBookings` defined; UI captures recurrence rule but scheduling generation is Phase Two).
- HelpSmart Family dashboard (collections defined; public page marks it "coming soon").
- Long-term employment placement (category group `jobs` exists but is inactive by policy flag).
- Elderly care and childcare (categories seeded inactive with `requiresSafeguarding: true`).
- Map view: the list view and neighbourhood-based distances work now. The map shows an "unavailable" note until a tile provider is chosen and `NEXT_PUBLIC_MAP_PROVIDER` is set (licence and terms review needed).
- SMS / phone-OTP sign-in (Firebase Phone Auth needs a configured project and reCAPTCHA / App Check).
- Push notifications via FCM: Cloud Function is written; the web client does not yet register device tokens (needs a VAPID key and project).
- Ethiopian calendar display, malware scanning of uploads, admin MFA enforcement (Identity Platform upgrade).

## 4. External dependencies (blocking production)

See `docs/OUTSTANDING_REQUIREMENTS.md` for the full list with owners.

1. Fayda relying-party authorisation from NIDP, partner portal onboarding, client ID, registered redirect URIs, signing key registration, issuer URL, scopes/claims and any userinfo encryption requirements from the official documentation.
2. Legal review of all policy placeholders and of mandatory-verification rules.
3. Payment partner agreements (Chapa / Telebirr / CBE Birr).
4. Data protection and cloud hosting review (Ethiopian Personal Data Protection Proclamation No. 1321/2024 and any data-localisation requirement).
5. Employment agency licensing review before activating HelpSmart Jobs.
