# Production readiness checklist

Tick every item before setting `APP_ENV=production`.

## Identity
- [ ] NIDP production authorisation received, and the sandbox flow tested end to end on staging
- [ ] `IDENTITY_MODE=fayda_oidc`; the app refuses to start with `dev_fixture` (verify the error)
- [ ] Retained claims confirmed against the Fayda agreement and the privacy review
- [ ] Identity encryption and HMAC keys created in Secret Manager, with a documented rotation plan
- [ ] No `dev_fixture` identities or `isDemo` users exist in the production database

## Security
- [ ] Firestore and Storage rules deployed from the same commit as the app; rules tests green
- [ ] MFA enforced for all staff accounts; at most two `super_admin`
- [ ] IAM reviewed: no personal service-account keys; App Hosting uses its runtime identity
- [ ] App Check enabled for the web app
- [ ] TTL policies on and verified
- [ ] Upload malware scanning in place (for example Cloud Storage scanning with a Cloud Function)
- [ ] Dependency audit clean; secrets scan clean
- [ ] Security headers verified on the live domain (CSP review done)
- [ ] External penetration test, especially the identity callback, admin API and Storage

## Legal and policy
- [ ] All legal documents reviewed and published; draft banners removed; consent text version updated
- [ ] Data protection registration and hosting decision documented
- [ ] Emergency numbers confirmed
- [ ] Commission and fees approved and set in platform settings

## Operations
- [ ] Backups: Firestore point-in-time recovery and scheduled exports enabled
- [ ] Monitoring and alerting: error rates, 5xx, function failures, identity failure rate, reconciliation issues
- [ ] Support team trained on verification exceptions, disputes, refunds and safety reports
- [ ] Incident response and escalation runbook, including cooperation with authorities
- [ ] Load test of search and booking at expected launch traffic

## Product
- [ ] Amharic reviewed by native speakers; other locales either reviewed or hidden
- [ ] Accessibility audit (WCAG 2.1 AA) passed on key flows
- [ ] Licensed photography in place
- [ ] Analytics and consent for analytics, if used
