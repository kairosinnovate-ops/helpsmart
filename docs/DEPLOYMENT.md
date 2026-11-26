# Deployment and admin provisioning

## Environments

| Alias | Firebase project | `APP_ENV` | `IDENTITY_MODE` |
|---|---|---|---|
| (local) | `demo-helpsmart` on the emulators | `development` | `dev_fixture` |
| `dev` | your dev project | `development` | `dev_fixture` or `disabled` |
| `staging` | staging project | `staging` | `disabled`, then `fayda_oidc` against the Fayda sandbox once onboarded |
| `prod` | production project | `production` | `disabled` until NIDP authorises production, then `fayda_oidc` |

Fill in the project ids in `.firebaserc`.

## One-time project setup

1. Create the Firebase project (Blaze plan). Choose the Firestore location after the data-protection review (see OUTSTANDING_REQUIREMENTS).
2. Enable Authentication → Email/Password. Add the production domain to the authorised domains.
3. Create Firestore (Native mode) and Cloud Storage.
4. Deploy rules and indexes: `npx firebase deploy --only firestore,storage -P staging`.
5. Turn on the TTL policies for `rateLimits.expiresAt` and `identityVerificationSessions.expiresAt`. The index file declares them; confirm in the console.
6. Create secrets in Secret Manager. Never put them in the repository:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # twice: encryption key and HMAC key
   npx firebase apphosting:secrets:set helpsmart-identity-encryption-key -P staging
   npx firebase apphosting:secrets:set helpsmart-identity-hmac-key -P staging
   npx firebase apphosting:secrets:set helpsmart-web-api-key -P staging
   ```
7. Create an App Hosting backend connected to this repository (`npx firebase apphosting:backends:create -P staging`). Edit `apphosting.yaml` for the environment (APP_ENV, domain, project values).
8. Deploy functions: `npm --prefix functions run build && npx firebase deploy --only functions -P staging`.
9. Seed reference data: `GCLOUD_PROJECT=<project> npm run seed -- --project` (add `--confirm-production` for prod). Demo data can never be written outside the emulator.

## Enabling Fayda (only after official onboarding)

Use only the values NIDP issues and the official documentation. Do not guess any of them.

1. Register the redirect URI `https://<domain>/api/identity/callback` and HelpSmart's public signing key (JWKS) in the partner portal.
2. Store the private signing JWK as the `helpsmart-fayda-client-private-jwk` secret, and the decryption JWK if userinfo is encrypted.
3. Set `FAYDA_ISSUER`, `FAYDA_CLIENT_ID`, `FAYDA_REDIRECT_URI`, and `FAYDA_SCOPES`, `FAYDA_ACR_VALUES`, `FAYDA_CLAIMS_REQUEST` and `FAYDA_RETAINED_CLAIMS` as the documentation and the data-protection review allow.
4. Set `IDENTITY_MODE=fayda_oidc`. Test end to end in the sandbox on staging before production.

If any value is missing, the app reports that verification is unavailable and keeps restricted features locked.

## Provisioning administrators

There is no sign-up path for staff. An operator with IAM access to the project:

1. Asks the staff member to create a normal account and verify their email.
2. Runs, with Application Default Credentials for the target project (`gcloud auth application-default login`):
   ```bash
   GCLOUD_PROJECT=<project-id> npm run admin:grant -- --email person@company.example --role verification_officer
   ```
   Roles: `super_admin`, `operations_manager`, `verification_officer`, `support_agent`, `finance_admin`, `marketplace_manager`, `read_only_analyst`.
3. To remove access: `npm run admin:grant -- --email person@company.example --revoke`.

The script sets the `adminRole` claim, revokes existing sessions, updates `adminUsers` and writes an audit entry. Keep at most two `super_admin` accounts.

## Release checklist

1. CI green on the PR (types, lint, unit, rules, integration, build).
2. Deploy to staging and run the manual script in `docs/TESTING.md`.
3. Deploy rules and indexes before the app, then the functions, then promote the App Hosting rollout.
4. Roll back by promoting the previous App Hosting rollout. Rules roll back by redeploying the previous commit.
