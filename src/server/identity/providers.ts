import "server-only";
import type { JWK } from "jose";
import { env, isDevFixtureAllowed } from "../env";
import { createOidcRelyingParty, type AuthRequestSecrets, type OidcRelyingParty } from "./oidc-rp";
import type { IdentitySource } from "@/domain/types";

/**
 * Identity provider registry. Fayda (via eSignet OIDC) is the Ethiopian provider.
 * Other countries can register their own provider here later (Phase Four) without
 * touching the verification service or the marketplace rules.
 */

export interface VerifiedIdentity {
  source: IdentitySource;
  issuer: string;
  subject: string;
  /** Only the claims we are allowed to retain (data minimisation). */
  retainedClaims: Record<string, unknown>;
  claimNamesReceived: string[];
  acr?: string;
}

export interface IdentityProvider {
  source: IdentitySource;
  authorizationUrl(secrets: AuthRequestSecrets): Promise<string>;
  exchange(code: string, secrets: AuthRequestSecrets): Promise<VerifiedIdentity>;
}

export type ProviderAvailability =
  | { ok: true; provider: IdentityProvider }
  | { ok: false; reason: "disabled" | "not_configured"; missing?: string[] };

let faydaRp: OidcRelyingParty | null = null;

function retain(claims: Record<string, unknown>): Record<string, unknown> {
  const allow = new Set(
    env()
      .FAYDA_RETAINED_CLAIMS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  // Never retain anything that looks like a raw national identifier, biometric, or OTP.
  const deny = /(fin|fan|uin|nin|national|individual_id|biometric|photo|picture|otp|face|finger|iris)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(claims)) if (allow.has(k) && !deny.test(k)) out[k] = v;
  return out;
}

function faydaProvider(): ProviderAvailability {
  const e = env();
  const missing: string[] = [];
  if (!e.FAYDA_ISSUER) missing.push("FAYDA_ISSUER");
  if (!e.FAYDA_CLIENT_ID) missing.push("FAYDA_CLIENT_ID");
  if (!e.FAYDA_REDIRECT_URI) missing.push("FAYDA_REDIRECT_URI");
  if (!e.FAYDA_CLIENT_PRIVATE_JWK) missing.push("FAYDA_CLIENT_PRIVATE_JWK");
  if (missing.length) return { ok: false, reason: "not_configured", missing };

  if (!faydaRp) {
    let clientJwk: JWK;
    let decJwk: JWK | undefined;
    try {
      clientJwk = JSON.parse(e.FAYDA_CLIENT_PRIVATE_JWK!);
      decJwk = e.FAYDA_USERINFO_DECRYPTION_JWK ? JSON.parse(e.FAYDA_USERINFO_DECRYPTION_JWK) : undefined;
    } catch {
      return { ok: false, reason: "not_configured", missing: ["valid JWK JSON"] };
    }
    faydaRp = createOidcRelyingParty({
      issuer: e.FAYDA_ISSUER!,
      clientId: e.FAYDA_CLIENT_ID!,
      redirectUri: e.FAYDA_REDIRECT_URI!,
      clientPrivateJwk: clientJwk,
      clientAssertionAlg: e.FAYDA_CLIENT_ASSERTION_ALG,
      scopes: e.FAYDA_SCOPES,
      acrValues: e.FAYDA_ACR_VALUES,
      claimsRequest: e.FAYDA_CLAIMS_REQUEST,
      uiLocales: e.FAYDA_UI_LOCALES,
      userinfoDecryptionJwk: decJwk,
      idTokenAlgs: e.FAYDA_EXPECTED_ID_TOKEN_ALGS.split(",").map((s) => s.trim()),
    });
  }
  const rp = faydaRp;
  return {
    ok: true,
    provider: {
      source: "fayda_oidc",
      authorizationUrl: (s) => rp.authorizationUrl(s),
      async exchange(code, s) {
        const r = await rp.exchangeCode(code, s);
        const all = { ...r.idTokenClaims, ...r.userinfo } as Record<string, unknown>;
        return {
          source: "fayda_oidc",
          issuer: r.issuer,
          subject: r.subject,
          retainedClaims: retain(all),
          claimNamesReceived: Object.keys(all).filter((k) => !["iss", "aud", "exp", "iat", "nonce", "sub", "azp", "at_hash"].includes(k)),
          acr: r.acr,
        };
      },
    },
  };
}

/**
 * DEVELOPMENT-ONLY fixture provider. It never contacts Fayda and its results are labelled
 * `dev_fixture`. env.ts refuses to boot with this mode in staging/production, and guards
 * reject dev_fixture identities outside development/test.
 */
const DEV_FIXTURE_ISSUER = "urn:helpsmart:dev-fixture";

function devFixtureProvider(): ProviderAvailability {
  if (!isDevFixtureAllowed()) return { ok: false, reason: "disabled" };
  return {
    ok: true,
    provider: {
      source: "dev_fixture",
      async authorizationUrl(s) {
        const u = new URL("/dev/identity-fixture", env().APP_BASE_URL);
        u.searchParams.set("state", s.state);
        return u.toString();
      },
      async exchange(code) {
        // code format: fixture.<scenario>.<subjectSeed>
        const [prefix, scenario, seed] = code.split(".");
        if (prefix !== "fixture" || !seed) throw new Error("invalid_fixture_code");
        if (scenario === "invalid_signature") {
          const { OidcError } = await import("./oidc-rp");
          throw new OidcError("invalid_id_token", "Fixture: simulated invalid signature");
        }
        if (scenario === "unavailable") {
          const { OidcError } = await import("./oidc-rp");
          throw new OidcError("discovery_failed", "Fixture: simulated outage");
        }
        return {
          source: "dev_fixture",
          issuer: DEV_FIXTURE_ISSUER,
          subject: `dev-${seed}`,
          retainedClaims: { name: "Dev Fixture Person" },
          claimNamesReceived: ["name"],
        };
      },
    },
  };
}

export function identityProvider(): ProviderAvailability {
  const mode = env().IDENTITY_MODE;
  if (mode === "fayda_oidc") return faydaProvider();
  if (mode === "dev_fixture") return devFixtureProvider();
  return { ok: false, reason: "disabled" };
}
