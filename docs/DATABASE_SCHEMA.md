# Database schema (Cloud Firestore)

Collection names are defined once in `src/server/collections.ts`. **Client access** is what `firestore.rules` allows. "Server only" means only route handlers and Cloud Functions using the Admin SDK can read or write it. No collection accepts client writes.

Money is always an integer number of santim (`…Minor`; 1 ETB = 100 santim). Times are Firestore timestamps unless noted as epoch milliseconds.

## Accounts and identity

| Collection | Key | Purpose and main fields | Client access |
|---|---|---|---|
| `users` | uid | `displayName`, `email` (lowercase), `phoneE164`, `locale`, `roles` (`customer`, `provider`), `primaryRole`, `accountStatus` (`active`, `suspended`, `deletion_requested`), `identityStatus` (`unverified`, `in_progress`, `fayda_verified`, `additional_review`, `failed`, `suspended`), `identitySource` (`fayda_oidc`, `dev_fixture`), `identityVerifiedAt`, `consents`, `onboarding`, `isDemo`, `fcmTokens` | Owner read |
| `users/{uid}/addresses` | auto | Saved addresses: sub-city, neighbourhood, landmark, directions, optional pin | Owner read |
| `customerProfiles` | uid | Preferences such as `preferredCategoryIds` | Server only |
| `adminUsers` | uid | Mirror of the `adminRole` custom claim for listing staff; `role`, `active`, `updatedBy` | Server only |
| `privateIdentityRecords` | uid | Encrypted allow-listed identity claims (`claims` is an AES-256-GCM blob), `retainedClaimNames`, `source` | Server only |
| `identityVerificationRecords` | auto | One row per attempt: `uid`, `provider`, `outcome` (`verified`, `cancelled`, `failed`, `additional_review`, `expired_session`, `replay`, `unavailable`), `subjectHash`, `acr`, `claimNamesReceived`, `consentRecordId`, `validated`, `reason` | Server only |
| `identityVerificationSessions` | sha256(state) | One-time session: `uid`, `provider`, encrypted `secrets` (nonce, PKCE verifier), `consentRecordId`, `expiresAt` (TTL), `used` | Server only |
| `identitySubjects` | HMAC(issuer, sub) | Links one national identity to one account for duplicate detection: `uid`, `source`, `linkedAt` | Server only |
| `verificationConsentRecords` | auto | `uid`, `purpose`, `provider`, `consentTextVersion`, `givenAt`, `userAgentHash`, `withdrawnAt` | Server only |

## Providers

| Collection | Key | Purpose and main fields | Client access |
|---|---|---|---|
| `providerProfiles` | uid | Private working profile: `title`, `bio`, `yearsExperience`, `languages`, `providerType`, `businessName`, `employmentPreferences`, `photoPath`, `categoryIds`, `serviceArea` (sub-city, neighbourhood, approximate `center`, `geohash`, `radiusKm`, `travelPreference`), `pricing` (`model`, `rateMinor`, `callOutFeeMinor`, `cancellationPolicy`), `availability`, `stats` (`ratingCount`, `ratingSums`, `ratingAverage`, `completedJobs`) | Server only |
| `providerApplications` | uid | `status` (`draft`, `submitted`, `under_review`, `info_required`, `approved`, `rejected`, `suspended`), `history[]`, `reviewNotes`, `reviewedBy` | Server only |
| `professionalCredentials` | auto | `providerId`, `type`, `title`, `issuer`, `storagePath` (under `credentials/{uid}/`), `expiresAt`, `status` (`pending`, `verified`, `rejected`) | Server only |
| `providerReferences` | auto | `providerId`, `name`, `relationship`, `phone`, `status` | Server only |
| `publicProfiles` | uid | Public projection, present only when approved, identity-verified and active: display fields, `cityId`, `subCityName`, `neighborhoodName`, `serviceCenter`, `categoryIds`, `startingPriceMinor`, rating summary, computed `badges`, `availableNow`, `isDemo`. No phone, email or identity data. | Public read |
| `savedProviders` | `${uid}_${providerId}` | `uid`, `providerId` | Owner read |

## Marketplace

| Collection | Key | Purpose and main fields | Client access |
|---|---|---|---|
| `serviceCategories` | slug | `names` (per locale), `group`, `description`, `icon`, `active`, `requiresSafeguarding`, `regulated`, `sortOrder` | Public read when active |
| `geographicRegions` | slug | `type` (`city`, `sub_city`, `neighborhood`), `parentId`, `cityId`, `names`, approximate `centroid`, `active` | Public read when active |
| `serviceRequests` | auto | Open requests for quotes: `customerId`, `categoryId`, `description`, `area`, `status` (`open`, `closed`, `booked`), `quoteCount` | Server only |
| `quotations` | `${requestId}_${providerId}` | `serviceRequestId`, `providerId`, `amountMinor`, `note`, `estimatedDuration`, `status` | Server only |
| `bookings` | auto | `reference`, `customerId`, `providerId`, names, `categoryId`, `description`, `urgency`, `scheduledFor`, `recurrence`, `priceModel`, `quantity`, `rateMinor`, `quote`, `breakdown` (see `PriceBreakdown`), `paymentMethod`, `paymentStatus`, `area` (approximate), `exactAddress` (hidden from the provider until confirmed), `status`, `completedAt`, `cancelledBy`, `cancelReason`, `reviewId` | Server only |
| `bookings/{id}/events` | auto | Status history: `type`, `from`, `to`, `actorId`, `actorRole`, `note`, `at` | Server only |
| `recurringBookings` | auto | Reserved for Phase Two scheduling | Server only |

## Trust, communication and support

| Collection | Key | Purpose and main fields | Client access |
|---|---|---|---|
| `reviews` | bookingId | One review per booking: `providerId`, `customerId`, per-dimension `ratings`, `comment`, `status` (`published`, `hidden`, `removed`), `providerResponse` | Public read when published |
| `reviewReports` | auto | Reports against reviews | Server only |
| `providerFeedback` | bookingId | Provider's private feedback about a customer; staff only | Server only |
| `conversations` | sorted uids joined by `__` | `participantIds`, `bookingId`, `lastMessage`, `lastMessageAt`, `unread` | Participants read |
| `conversations/{id}/messages` | auto | `senderId`, `text`, `flagged` (links or contact details), `createdAt` | Participants read |
| `userBlocks` | `${blocker}_${blocked}` | Block list | Server only |
| `notifications` | auto | `uid`, `type`, `title`, `body`, `link`, `read`, `createdAt` | Owner read |
| `supportTickets` | auto | User support cases, including account deletion requests | Server only |
| `incidentReports` | auto | Safety and misconduct reports | Server only |
| `disputes` | bookingId | `openedBy`, `reason`, `status`, `resolution` | Server only |

## Money

| Collection | Key | Purpose and main fields | Client access |
|---|---|---|---|
| `payments` | bookingId | `method`, `amountMinor`, `breakdown`, `status` (`pending`, `awaiting_confirmation`, `paid`, `refund_pending`, `refunded`, `disputed`), `confirmations` (`customer`, `provider`), gateway reference | Server only |
| `transactions` | `${bookingId}_${type}` | Ledger lines written only after a payment is confirmed: `service_value`, `commission`, `customer_fee`, refunds; `settlement` | Server only |
| `paymentEvents` | `${gateway}_${eventId}` | Webhook idempotency records | Server only |
| `reconciliationIssues` | auto | Webhook amount or booking mismatches | Server only |

## Platform

| Collection | Key | Purpose | Client access |
|---|---|---|---|
| `platformSettings` | `marketplace` | Commission rate, service fee, feature flags (care, jobs, family), payment methods, safety numbers | Server only |
| `announcements` | auto | Reserved | Server only |
| `auditLogs` | auto | Append-only: `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `metadata`, `at` | Server only |
| `rateLimits` | key | Fixed-window counters, `expiresAt` (TTL) | Server only |

## Indexes and TTL

Composite indexes are in `firestore.indexes.json`. Enable TTL policies on `rateLimits.expiresAt` and `identityVerificationSessions.expiresAt` (also declared there). The hourly `cleanupExpired` function is a fallback.

## Storage layout

| Path | Contents | Access |
|---|---|---|
| `credentials/{uid}/…` | Certificates and licences (PDF or image, up to 10 MB, cannot be overwritten) | Owner upload and read; verification staff read |
| `providers/{uid}/…` | Profile and portfolio photos (image, up to 5 MB) | Owner write; public read |
| `requests/{uid}/…`, `bookings/{uid}/…` | Job photos (image, up to 5 MB) | Owner upload and read |
