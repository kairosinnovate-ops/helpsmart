# Testing

Java 21 is required for the Firebase emulators.

| Suite | Command | Count | What it proves |
|---|---|---|---|
| Unit | `npm test` | 58 | Booking state machine, pricing and commission, review eligibility and aggregates, badge rules (Fayda badge only from `fayda_oidc`), ranking gates and determinism, phone normalisation, geo, permissions, environment guard (fixture refused in staging and production) |
| OIDC relying party | part of `npm test` | (included above) | Against a local mock OpenID provider (not Fayda): PKCE, `private_key_jwt`, rejects wrong issuer, unknown signing key, wrong audience, expired token, bad `azp`, nonce mismatch or missing, userinfo subject mismatch, encrypted userinfo without a key, token errors and outages |
| Security rules | `npm run test:rules` | 14 | Firestore: no client writes anywhere, owner-only reads, identity records unreadable, bookings and payments server-only, participants-only messages. Storage: owner-only folders, type and size limits, no overwriting credentials, staff-only credential reads |
| Integration | `npm run test:integration` | 10 | On the emulators with the development fixture: verification, replay blocked, raw subject never stored, duplicate identity → review, account mismatch, failure and outage handling, approval blocked without verification, profile published only when verified and approved, full booking → completion → two-sided payment → ledger → single review, suspension removes the profile |

Run everything with `npm run test:all`. CI (`.github/workflows/ci.yml`) runs the same steps plus the production build.

## Manual test script (before each release)

1. Sign up as a customer and as a provider. Check +251 validation and email verification.
2. Verify identity (fixture in development). Try the "cancel", "invalid signature" and "outage" fixture scenarios.
3. Complete provider onboarding, upload a credential, submit. Approve as a `verification_officer`.
4. Search by sub-city and category. Book at the listed rate and through a quote.
5. Walk the booking to completion. Confirm payment from both sides. Leave a review and a provider response.
6. Open a dispute. Resolve it as an admin with refund. Check the audit log and finance export.
7. Switch the language to Amharic and check that nothing overflows.
8. Keyboard-only pass and a screen reader pass on sign-up, search and booking.
