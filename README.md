# HelpSmart

**Find help. Live smarter.** HelpSmart is a marketplace for trusted home services in Ethiopia. Addis Ababa is the first market.

This repository holds the Phase One MVP. It is one Next.js application that serves four surfaces:

| Surface | Path | Who uses it |
|---|---|---|
| Public site | `/`, `/how-it-works`, `/become-a-helper`, `/safety`, `/legal/*` | Everyone |
| Customer app | `/home`, `/explore`, `/providers/*`, `/bookings`, `/requests`, `/messages`, `/account` | Households and businesses |
| HelpSmart Pro | `/pro/*` | Service professionals |
| HelpSmart Admin | `/admin/*` | HelpSmart staff (7 roles) |

The JSON API under `/api/v1` and `/api/admin` serves the same features to future mobile apps.

> **Status:** MVP code complete and tested on the Firebase emulators. It is **not ready for production**. Fayda identity verification, payment gateways and legal policies all need outside approvals first. See [docs/OUTSTANDING_REQUIREMENTS.md](docs/OUTSTANDING_REQUIREMENTS.md).

## Stack

- Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4
- Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions (2nd gen), Firebase App Hosting
- `jose` for OpenID Connect (Fayda eSignet relying party), `zod` for validation
- Vitest and `@firebase/rules-unit-testing` on the Firebase Emulator Suite

## Run it locally

Prerequisites: Node 22 or newer, and Java 21 for the Firebase emulators.

```bash
npm install
npm --prefix functions install
cp .env.example .env.local        # emulator defaults, development identity fixture
npm run emulators                 # terminal 1: Auth, Firestore, Storage, Functions, UI on :4000
npm run seed:demo                 # terminal 2: reference data and 4 labelled demo providers
npm run dev                       # terminal 2: http://localhost:3000
```

To make yourself an admin on the emulator, sign up in the app, then run:

```bash
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-helpsmart \
  npm run admin:grant -- --email you@example.com --role super_admin
```

Sign out and back in to pick up the new role.

**Identity in development.** With `IDENTITY_MODE=dev_fixture`, the "Verify with Fayda" button opens a local fixture page. The fixture never contacts Fayda. Its results are stored as `source: dev_fixture`, never earn the Fayda Verified badge, and the app refuses to start with this mode when `APP_ENV` is `staging` or `production`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint |
| `npm test` | Unit tests: domain logic, environment guard, OIDC relying party against a local mock provider |
| `npm run test:rules` | Firestore and Storage security rules on the emulators |
| `npm run test:integration` | Service tests on the emulators: identity flow, provider approval, booking, payment, review |
| `npm run test:all` | All of the above |
| `npm run seed` / `seed:demo` | Reference data / plus demo providers (emulator only) |
| `npm run admin:grant` | Grant or revoke an admin role (the only way to create admins) |

## Repository layout

```
src/
  app/            routes: (public), (auth), (app) customer, pro, admin, api
  components/     design system (ui/), trust badges, layout shells
  domain/         pure business rules: booking state machine, pricing, reviews, badges, ranking, permissions
  server/         server-only code: env, auth guards, identity (Fayda OIDC), services, payments
  lib/            client helpers: API client, i18n, Firebase web SDK
  messages/       i18n catalogues (en complete; am draft; om, ti, so fall back to English)
  content/        long-form page and legal placeholder content
  data/           reference data seeds (categories, Addis Ababa regions, default settings)
functions/        Cloud Functions: push notifications, housekeeping
scripts/          seed and admin provisioning
tests/            unit, rules, integration
docs/             architecture, schema, security, API, testing, deployment, checklists
```

## Documentation

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Security and privacy](docs/SECURITY.md)
- [API reference](docs/API.md)
- [Testing](docs/TESTING.md)
- [Deployment and admin provisioning](docs/DEPLOYMENT.md)
- [MVP checklist](docs/MVP_CHECKLIST.md)
- [Outstanding requirements](docs/OUTSTANDING_REQUIREMENTS.md)
- [Production readiness checklist](docs/PRODUCTION_READINESS.md)
