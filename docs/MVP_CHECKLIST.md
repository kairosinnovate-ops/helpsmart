# Phase One MVP checklist

✅ done and tested · 🟡 built, needs an outside dependency to go live · ⏳ deferred

## Accounts and identity
- ✅ Email and password sign-up with email verification, +251 phone validation, customer or provider account type
- ✅ Session cookies for web and Bearer tokens for mobile; suspended-account handling
- ✅ Identity verification service with consent records, one-time sessions, replay protection, duplicate detection, encrypted claims, audit trail
- 🟡 Fayda OIDC relying party: built and tested against a mock provider. Needs NIDP onboarding values
- ✅ Development identity fixture (development and test only, clearly labelled, never the Fayda badge)
- ⏳ Phone OTP sign-in

## Marketplace
- ✅ Admin-managed categories (5 launch categories active; care and jobs gated by flags)
- ✅ Addis Ababa sub-cities and neighbourhoods with approximate centroids
- ✅ Provider onboarding wizard: profile, categories, area, pricing, availability, credentials, references, submit
- ✅ Public profiles only for approved, verified, active providers; computed badges
- ✅ Search with filters and sorts, deterministic ranking without protected attributes
- 🟡 Map view (needs a tile provider); list view and distances work
- ✅ Saved providers

## Bookings and communication
- ✅ Book at the listed rate, request a custom quote, or post a request for several quotes
- ✅ Server-validated booking lifecycle with history, cancellation, disputes
- ✅ Exact address shown to the provider only after confirmation
- ✅ In-app messaging with realtime updates, link flagging and blocking
- ✅ In-app notifications
- 🟡 Push notifications (function written; device registration and a VAPID key outstanding)
- ⏳ Recurring booking generation (rule captured only)

## Trust
- ✅ Reviews only from the customer of a completed booking, once, within 30 days; 6 dimensions; provider responses; reports; moderation
- ✅ Private provider feedback about customers, with safety-concern escalation
- ✅ Safety page, reporting from profiles, bookings and messages

## Payments
- ✅ Price breakdown with commission (12% default, admin-configurable), integer santim
- ✅ Cash and bank transfer with two-sided confirmation and ledger entries
- ✅ Provider earnings view
- 🟡 Telebirr, CBE Birr, Chapa adapters (report "not configured"); webhook with signatures, idempotency and reconciliation

## Admin
- ✅ Executive overview from real counts (demo records excluded outside development)
- ✅ Users, verification monitoring, applications, credentials, references, bookings, disputes, reviews, support, categories, settings, finance export, audit log
- ✅ Seven roles with least privilege; scripted admin provisioning

## Platform
- ✅ English catalogue complete; Amharic draft; Afaan Oromo, Tigrinya and Somali fall back to English
- 🟡 Translations reviewed by native speakers
- ✅ Responsive layouts, focus states, reduced motion, semantic forms
- ✅ Deny-by-default Firestore and Storage rules with tests
- ✅ Cloud Functions: push fan-out, housekeeping
- ✅ CI workflow, App Hosting config, environment template
- 🟡 Legal documents (placeholders marked as drafts)
