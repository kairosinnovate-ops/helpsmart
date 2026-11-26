# Outstanding requirements

These are outside the code and block a production launch. Owner is HelpSmart unless noted.

| # | Item | Needed from | Blocks | Notes |
|---|---|---|---|---|
| 1 | Fayda relying-party authorisation and partner onboarding | National ID Program (NIDP) | Identity verification, provider approval, restricted actions | Need issuer URL, client ID, registered redirect URIs, key registration (private_key_jwt), allowed scopes and claims, ACR values, userinfo signing or encryption, sandbox access, and the terms on retention and use. Nothing in the code assumes these values. |
| 2 | Legal review of terms, privacy policy, identity consent, provider agreement, community guidelines, cancellation and refund, safety, data retention, complaints and appeals | Ethiopian counsel | Launch | All are placeholders in `src/content/pages.ts`, marked as drafts. Consent text version is `identity-consent-draft-2026-11`. |
| 3 | Whether identity verification may be mandatory for booking and messaging | Counsel, NIDP | Policy setting | Controlled by `requireIdentityForRestrictedActions`. |
| 4 | Data protection review (Personal Data Protection Proclamation No. 1321/2024), cross-border transfer and data localisation | Counsel, regulator | Choosing the Firebase region | Firestore location cannot be changed after creation. |
| 5 | Payment partner agreements and API documentation | Chapa, Telebirr, CBE Birr | Online payments | Adapters exist but report "not configured". No escrow or wallet until a licensed arrangement exists. |
| 6 | Commission and fee policy | HelpSmart | Pricing | 12% is a development default. |
| 7 | Business registration (HelpSmart Technologies PLC is proposed) and tax treatment of commission | Counsel, accountant | Invoicing, finance export | |
| 8 | Employment agency licensing review | Counsel, Ministry of Labour and Skills | HelpSmart Jobs, long-term domestic placement | Category is inactive behind `jobsModuleEnabled`. |
| 9 | Safeguarding policy, training and checks for elderly care and childcare | HelpSmart, specialists | Care categories | Inactive behind `careServicesEnabled`. |
| 10 | Emergency numbers confirmed (991, 907, 939 used as placeholders) | Authorities | Safety page | Editable in platform settings. |
| 11 | Official sub-city and neighbourhood boundaries and Amharic names | Addis Ababa City Administration data | Search accuracy | Centroids are approximate. |
| 12 | Native-speaker translation and review: Amharic, Afaan Oromo, Tigrinya, Somali | Translators | Multilingual launch | |
| 13 | Licensed photography with model releases | HelpSmart | Marketing pages | See `public/images/README.md`. |
| 14 | Map tile provider and licence | HelpSmart | Map view | Set `NEXT_PUBLIC_MAP_PROVIDER`. |
| 15 | Firebase projects (dev, staging, prod), billing, domains, Secret Manager secrets | HelpSmart | Any deployment | See `docs/DEPLOYMENT.md`. |
| 16 | Support contact details, company address, security contact | HelpSmart | Contact page, security reporting | |
| 17 | SMS provider for phone verification and notifications | Ethio telecom or an aggregator | Phone OTP, SMS alerts | Deferred. |
