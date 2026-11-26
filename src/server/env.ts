import "server-only";
import { z } from "zod";

/**
 * Server environment. Parsed lazily so `next build` works without secrets,
 * but every consumer gets a validated, typed config — and production fails closed.
 */

const AppEnv = z.enum(["development", "test", "staging", "production"]);
export type AppEnv = z.infer<typeof AppEnv>;

const schema = z.object({
  APP_ENV: AppEnv.default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  // Identity verification
  IDENTITY_MODE: z.enum(["fayda_oidc", "dev_fixture", "disabled"]).default("disabled"),
  FAYDA_ISSUER: z.string().url().optional(),
  FAYDA_CLIENT_ID: z.string().min(1).optional(),
  FAYDA_REDIRECT_URI: z.string().url().optional(),
  /** Private JWK (JSON) registered with Fayda for private_key_jwt client authentication. Secret Manager only. */
  FAYDA_CLIENT_PRIVATE_JWK: z.string().optional(),
  FAYDA_CLIENT_ASSERTION_ALG: z.string().default("RS256"),
  FAYDA_SCOPES: z.string().default("openid profile"),
  FAYDA_ACR_VALUES: z.string().optional(),
  /** Optional OIDC `claims` request parameter (JSON) as required by the official documentation. */
  FAYDA_CLAIMS_REQUEST: z.string().optional(),
  FAYDA_UI_LOCALES: z.string().optional(),
  /** Optional private JWK to decrypt JWE userinfo responses, when the provider encrypts them. */
  FAYDA_USERINFO_DECRYPTION_JWK: z.string().optional(),
  FAYDA_EXPECTED_ID_TOKEN_ALGS: z.string().default("RS256,PS256,ES256"),
  /** Identity attributes we are allowed to keep (comma separated claim names). Data minimisation. */
  FAYDA_RETAINED_CLAIMS: z.string().default("name,birthdate,gender"),

  // Application-layer crypto for sensitive identity data (32 random bytes, base64)
  IDENTITY_ENCRYPTION_KEY: z.string().optional(),
  IDENTITY_HMAC_KEY: z.string().optional(),

  // Payments
  PAYMENT_GATEWAYS_ENABLED: z.string().default(""),
  CHAPA_WEBHOOK_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  const e = parsed.data;
  if ((e.APP_ENV === "production" || e.APP_ENV === "staging") && e.IDENTITY_MODE === "dev_fixture") {
    // Hard stop: simulated identity must never run outside development.
    throw new Error("IDENTITY_MODE=dev_fixture is forbidden when APP_ENV is staging or production");
  }
  if (e.APP_ENV === "production" && (!e.IDENTITY_ENCRYPTION_KEY || !e.IDENTITY_HMAC_KEY)) {
    throw new Error("IDENTITY_ENCRYPTION_KEY and IDENTITY_HMAC_KEY are required in production");
  }
  cached = e;
  return e;
}

/** Test helper only. */
export function resetEnvCache() {
  cached = null;
}

export function isDevFixtureAllowed(): boolean {
  const e = env();
  return e.APP_ENV === "development" || e.APP_ENV === "test" ? e.IDENTITY_MODE === "dev_fixture" : false;
}
