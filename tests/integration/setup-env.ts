// Test environment for service integration tests on the Firebase emulators. No real credentials.
process.env.APP_ENV = "test";
process.env.IDENTITY_MODE = "dev_fixture";
process.env.APP_BASE_URL = "http://localhost:3000";
process.env.GCLOUD_PROJECT ??= "demo-helpsmart";
process.env.IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.IDENTITY_HMAC_KEY = Buffer.alloc(32, 9).toString("base64");
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Integration tests must run on the Firestore emulator (npm run test:integration).");
