import {
  createRemoteJWKSet,
  jwtVerify,
  SignJWT,
  importJWK,
  compactDecrypt,
  decodeProtectedHeader,
  type JWTPayload,
  type JWK,
} from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";

/**
 * Standards-based OpenID Connect relying party used for Fayda eSignet.
 *
 * Nothing in here is Fayda-specific or hard-coded: every endpoint comes from the issuer's
 * discovery document (`/.well-known/openid-configuration`) for the issuer configured by
 * the operator after official partner onboarding. Scopes, claims, ACR values and the client
 * authentication method are configuration, to be set from the official Fayda documentation.
 *
 * Security properties implemented here:
 *  - Authorization Code Flow with PKCE (S256)
 *  - `state` (CSRF) and `nonce` (replay) — generated here, checked by the caller/here
 *  - `private_key_jwt` client authentication (no shared secret in the browser, ever)
 *  - ID token signature (issuer JWKS), `iss`, `aud`, `azp`, `exp`, `iat`, `nonce` validation
 *  - Userinfo: JSON or signed JWT (verified against JWKS) and optional JWE decryption
 *  - `sub` of userinfo must equal `sub` of the ID token
 */

export interface OidcRpConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  clientPrivateJwk: JWK;
  clientAssertionAlg: string;
  scopes: string;
  acrValues?: string;
  claimsRequest?: string;
  uiLocales?: string;
  userinfoDecryptionJwk?: JWK;
  idTokenAlgs: string[];
  /** Allowed clock skew in seconds. */
  clockToleranceSec?: number;
  fetchImpl?: typeof fetch;
}

export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  code_challenge_methods_supported?: string[];
}

export class OidcError extends Error {
  constructor(
    public readonly code:
      | "discovery_failed"
      | "issuer_mismatch"
      | "token_exchange_failed"
      | "invalid_id_token"
      | "nonce_mismatch"
      | "userinfo_failed"
      | "subject_mismatch"
      | "encrypted_userinfo_unsupported",
    message: string,
  ) {
    super(message);
  }
}

export interface AuthRequestSecrets {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export function newAuthRequestSecrets(): AuthRequestSecrets {
  const b = (n: number) => randomBytes(n).toString("base64url");
  return { state: b(32), nonce: b(32), codeVerifier: b(48) };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface VerifiedOidcIdentity {
  issuer: string;
  subject: string;
  idTokenClaims: JWTPayload;
  userinfo: Record<string, unknown>;
  acr?: string;
  authTime?: number;
}

export function createOidcRelyingParty(cfg: OidcRpConfig) {
  const f = cfg.fetchImpl ?? fetch;
  let discovery: { doc: DiscoveryDocument; at: number } | null = null;
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  async function discover(): Promise<DiscoveryDocument> {
    if (discovery && Date.now() - discovery.at < 60 * 60 * 1000) return discovery.doc;
    const url = `${cfg.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
    let res: Response;
    try {
      res = await f(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    } catch {
      throw new OidcError("discovery_failed", "Identity provider is unreachable");
    }
    if (!res.ok) throw new OidcError("discovery_failed", `Discovery returned ${res.status}`);
    const doc = (await res.json()) as DiscoveryDocument;
    if (doc.issuer !== cfg.issuer) throw new OidcError("issuer_mismatch", "Discovery issuer does not match configuration");
    for (const k of ["authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
      if (!doc[k] || !doc[k].startsWith("https://")) {
        // Allow http only for loopback test servers.
        if (!(doc[k] && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(doc[k]))) {
          throw new OidcError("discovery_failed", `Discovery document missing secure ${k}`);
        }
      }
    }
    discovery = { doc, at: Date.now() };
    jwks = createRemoteJWKSet(new URL(doc.jwks_uri));
    return doc;
  }

  async function authorizationUrl(secrets: AuthRequestSecrets): Promise<string> {
    const d = await discover();
    const u = new URL(d.authorization_endpoint);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", cfg.clientId);
    u.searchParams.set("redirect_uri", cfg.redirectUri);
    u.searchParams.set("scope", cfg.scopes);
    u.searchParams.set("state", secrets.state);
    u.searchParams.set("nonce", secrets.nonce);
    u.searchParams.set("code_challenge", pkceChallenge(secrets.codeVerifier));
    u.searchParams.set("code_challenge_method", "S256");
    if (cfg.acrValues) u.searchParams.set("acr_values", cfg.acrValues);
    if (cfg.claimsRequest) u.searchParams.set("claims", cfg.claimsRequest);
    if (cfg.uiLocales) u.searchParams.set("ui_locales", cfg.uiLocales);
    return u.toString();
  }

  async function clientAssertion(tokenEndpoint: string): Promise<string> {
    const key = await importJWK(cfg.clientPrivateJwk, cfg.clientAssertionAlg);
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: cfg.clientAssertionAlg, ...(cfg.clientPrivateJwk.kid ? { kid: cfg.clientPrivateJwk.kid } : {}) })
      .setIssuer(cfg.clientId)
      .setSubject(cfg.clientId)
      .setAudience(tokenEndpoint)
      .setJti(randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(key);
  }

  async function verifyIdToken(idToken: string, expectedNonce: string): Promise<JWTPayload> {
    await discover();
    try {
      const { payload } = await jwtVerify(idToken, jwks!, {
        issuer: cfg.issuer,
        audience: cfg.clientId,
        algorithms: cfg.idTokenAlgs,
        clockTolerance: cfg.clockToleranceSec ?? 60,
        requiredClaims: ["sub", "iat", "exp", "nonce"],
      });
      if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== cfg.clientId) {
        throw new OidcError("invalid_id_token", "azp does not match client");
      }
      if (payload.nonce !== expectedNonce) throw new OidcError("nonce_mismatch", "Nonce mismatch");
      return payload;
    } catch (e) {
      if (e instanceof OidcError) throw e;
      throw new OidcError("invalid_id_token", `ID token rejected: ${(e as Error).name}`);
    }
  }

  async function readUserinfo(accessToken: string, subject: string): Promise<Record<string, unknown>> {
    const d = await discover();
    if (!d.userinfo_endpoint) return {};
    let res: Response;
    try {
      res = await f(d.userinfo_endpoint, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new OidcError("userinfo_failed", "Userinfo endpoint unreachable");
    }
    if (!res.ok) throw new OidcError("userinfo_failed", `Userinfo returned ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    let claims: Record<string, unknown>;
    if (ct.includes("application/json")) {
      claims = (await res.json()) as Record<string, unknown>;
    } else {
      let jwt = (await res.text()).trim();
      if (jwt.split(".").length === 5) {
        if (!cfg.userinfoDecryptionJwk) {
          throw new OidcError("encrypted_userinfo_unsupported", "Encrypted userinfo received but no decryption key configured");
        }
        const hdr = decodeProtectedHeader(jwt);
        const key = await importJWK(cfg.userinfoDecryptionJwk, hdr.alg as string);
        const { plaintext } = await compactDecrypt(jwt, key);
        jwt = new TextDecoder().decode(plaintext);
      }
      try {
        const { payload } = await jwtVerify(jwt, jwks!, {
          issuer: cfg.issuer,
          audience: cfg.clientId,
          algorithms: cfg.idTokenAlgs,
          clockTolerance: cfg.clockToleranceSec ?? 60,
        });
        claims = payload as Record<string, unknown>;
      } catch (e) {
        throw new OidcError("userinfo_failed", `Signed userinfo rejected: ${(e as Error).name}`);
      }
    }
    if (claims.sub !== subject) throw new OidcError("subject_mismatch", "Userinfo subject does not match ID token");
    return claims;
  }

  async function exchangeCode(code: string, secrets: Pick<AuthRequestSecrets, "nonce" | "codeVerifier">): Promise<VerifiedOidcIdentity> {
    const d = await discover();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: secrets.codeVerifier,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: await clientAssertion(d.token_endpoint),
    });
    let res: Response;
    try {
      res = await f(d.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new OidcError("token_exchange_failed", "Token endpoint unreachable");
    }
    if (!res.ok) throw new OidcError("token_exchange_failed", `Token endpoint returned ${res.status}`);
    const tok = (await res.json()) as { id_token?: string; access_token?: string; token_type?: string };
    if (!tok.id_token) throw new OidcError("invalid_id_token", "No ID token in response");
    const idClaims = await verifyIdToken(tok.id_token, secrets.nonce);
    const subject = idClaims.sub!;
    const userinfo = tok.access_token ? await readUserinfo(tok.access_token, subject) : {};
    return {
      issuer: cfg.issuer,
      subject,
      idTokenClaims: idClaims,
      userinfo,
      acr: typeof idClaims.acr === "string" ? idClaims.acr : undefined,
      authTime: typeof idClaims.auth_time === "number" ? idClaims.auth_time : undefined,
    };
  }

  return { discover, authorizationUrl, exchangeCode, verifyIdToken };
}

export type OidcRelyingParty = ReturnType<typeof createOidcRelyingParty>;
