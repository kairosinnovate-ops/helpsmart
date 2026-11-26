# Security and privacy

## Threat model in brief

| Threat | Control |
|---|---|
| User grants themselves verification, roles, badges, ratings, payment status or commission | Firestore rules deny all client writes. Server services own every field. Badges are computed from evidence in `src/domain/badges.ts`. Rules tests cover this. |
| Staff grants the Fayda Verified badge by hand | No permission or API creates a verification. Provider approval requires `identityStatus = fayda_verified`. Resolving `additional_review` requires a validated record from the provider. The badge also requires `identitySource = fayda_oidc`. |
| Simulated identity reaches production | `env.ts` refuses to start with `IDENTITY_MODE=dev_fixture` in staging or production. The fixture provider is disabled outside development and test. Fixture identities stop counting outside development, and they never earn the Fayda badge. |
| OIDC attacks (forged tokens, replay, mix-up, CSRF, code injection) | PKCE S256, `state` stored as a hash and consumed once in a transaction, `nonce`, issuer from discovery checked against configuration, JWKS signature check with an algorithm allow-list, `aud`/`azp`/`exp` checks, userinfo `sub` must match, callback bound to the signed-in account, `private_key_jwt` client auth. Tests run against a local mock provider. |
| One national identity on several accounts | `identitySubjects/{HMAC(issuer|sub)}` links one identity to one account. Duplicates go to `additional_review`. |
| CSRF on cookie-authenticated API | `Origin` check on every mutation, SameSite=Lax cookie |
| Session theft | httpOnly, Secure (in production) session cookie, 5 days. Sign-in must be within 5 minutes to mint it. Sign-out revokes refresh tokens. Suspended accounts are blocked in guards. |
| Account enumeration and abuse | Firebase Auth generic errors, Firestore-backed rate limits on sign-up helpers, verification start, bookings and messages |
| Off-platform contact before booking | Phone numbers are never shown publicly. The exact address is shown to the provider only after confirmation. Messages containing links or contact details are flagged. |
| Malicious uploads | Storage rules restrict paths to the owner's folder, content types and sizes. Credentials cannot be overwritten and are readable only by the owner and verification staff. Malware scanning is outstanding. |
| Payment fraud | No money is held. Cash and bank transfer need confirmation from both sides. Webhooks need signatures, are idempotent and reconcile amounts. |
| Ranking discrimination | Ranking inputs exclude protected characteristics by type (`RankableProvider`). No pay-to-rank. |

## Sensitive data handling

- **Never stored:** Fayda OTPs, biometrics, face images, FIN/FAN in clear text, passwords (Firebase Auth handles them).
- **Encrypted at the application layer (AES-256-GCM, `IDENTITY_ENCRYPTION_KEY`):** retained identity claims, OIDC nonce and PKCE verifier.
- **Hashed (HMAC-SHA-256, `IDENTITY_HMAC_KEY`):** the identity subject.
- **Retained claims** are an allow-list (`FAYDA_RETAINED_CLAIMS`, default `name,birthdate,gender`). A deny pattern also drops anything that looks like an identifier, a photo, a biometric or an OTP. Gender and birth date are never used in search or ranking.
- **Keys:** Cloud Secret Manager only. Rotating the HMAC key breaks duplicate detection for existing links, so plan a re-hash migration first.

## Admin access

- Roles come from the `adminRole` custom claim, set only by `scripts/provision-admin.ts` (operator with IAM access). There is no self-service path.
- Seven roles with least privilege (`src/domain/permissions.ts`). Every admin action is audited.
- Before production: enforce MFA for staff (Identity Platform), restrict IAM, and review admin accounts every quarter.

## Data retention (engineering schedule, to be confirmed by legal)

| Data | Retention |
|---|---|
| Identity verification sessions | 15 minutes (TTL) |
| Rate-limit counters | 2 windows (TTL) |
| Verification records and consent records | Life of the account + 5 years, or as required by law and the Fayda agreement |
| Private identity claims | Deleted or anonymised when the account is deleted |
| Bookings, payments, transactions, audit logs | 10 years (financial and audit obligations) |
| Messages | 2 years after the last message, unless tied to a dispute or report |
| Support tickets, reports, disputes | 5 years after resolution |
| Uploaded credentials | While the provider is active + 1 year |

Account deletion anonymises personal fields and keeps records the law requires. Staff process requests from the admin dashboard.

## Reporting a vulnerability

Until a security contact is published, report issues privately to the repository owners. Do not open public issues for vulnerabilities.
