/**
 * Negative and positive tests for the OIDC relying party against a LOCAL MOCK identity provider.
 * The mock is a generic OpenID Connect test server written for these tests. It is not Fayda, does not
 * imitate Fayda endpoints or responses, and is never reachable from the application.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { CompactEncrypt, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { createOidcRelyingParty, newAuthRequestSecrets, OidcError, pkceChallenge } from "@/server/identity/oidc-rp";

type Behaviour = {
  idTokenClaims?: Record<string, unknown>;
  signWithRogueKey?: boolean;
  userinfo?: "json" | "jws" | "jwe";
  userinfoSub?: string;
  discoveryIssuer?: string;
  tokenStatus?: number;
};

let server: Server;
let issuer: string;
let opKey: CryptoKey;
let rogueKey: CryptoKey;
let opJwk: JWK;
let clientJwk: JWK;
let encPublic: CryptoKey;
let encPrivateJwk: JWK;
let behaviour: Behaviour = {};
let lastTokenRequest: URLSearchParams | null = null;
const CLIENT_ID = "test-client";

async function sign(claims: Record<string, unknown>, key = opKey) {
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "op-1" }).sign(key);
}

beforeAll(async () => {
  const op = await generateKeyPair("RS256", { extractable: true });
  opKey = op.privateKey;
  opJwk = { ...(await exportJWK(op.publicKey)), kid: "op-1", alg: "RS256", use: "sig" };
  rogueKey = (await generateKeyPair("RS256")).privateKey;
  const client = await generateKeyPair("RS256", { extractable: true });
  clientJwk = { ...(await exportJWK(client.privateKey)), kid: "client-1" };
  const enc = await generateKeyPair("RSA-OAEP-256", { extractable: true });
  encPublic = enc.publicKey;
  encPrivateJwk = await exportJWK(enc.privateKey);

  server = createServer(async (req, res) => {
    const url = new URL(req.url!, issuer);
    if (url.pathname === "/.well-known/openid-configuration") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({
        issuer: behaviour.discoveryIssuer ?? issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        userinfo_endpoint: `${issuer}/userinfo`,
      }));
    }
    if (url.pathname === "/jwks") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ keys: [opJwk] }));
    }
    if (url.pathname === "/token") {
      let raw = "";
      for await (const c of req) raw += c;
      lastTokenRequest = new URLSearchParams(raw);
      if (behaviour.tokenStatus) { res.statusCode = behaviour.tokenStatus; return res.end("{}"); }
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: issuer, aud: CLIENT_ID, sub: "subject-123", iat: now, exp: now + 300, nonce: "NONCE", ...behaviour.idTokenClaims };
      const id_token = await sign(claims, behaviour.signWithRogueKey ? rogueKey : opKey);
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ id_token, access_token: "at", token_type: "Bearer" }));
    }
    if (url.pathname === "/userinfo") {
      const sub = behaviour.userinfoSub ?? "subject-123";
      const claims = { sub, name: "Test Person", iss: issuer, aud: CLIENT_ID };
      if (!behaviour.userinfo || behaviour.userinfo === "json") {
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ sub, name: "Test Person" }));
      }
      const jws = await sign(claims);
      res.setHeader("content-type", "application/jwt");
      if (behaviour.userinfo === "jws") return res.end(jws);
      const jwe = await new CompactEncrypt(new TextEncoder().encode(jws)).setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" }).encrypt(encPublic);
      return res.end(jwe);
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => { behaviour = {}; lastTokenRequest = null; });

function rp(extra: Partial<Parameters<typeof createOidcRelyingParty>[0]> = {}) {
  return createOidcRelyingParty({
    issuer,
    clientId: CLIENT_ID,
    redirectUri: "http://localhost:3000/api/identity/callback",
    clientPrivateJwk: clientJwk,
    clientAssertionAlg: "RS256",
    scopes: "openid profile",
    idTokenAlgs: ["RS256"],
    ...extra,
  });
}

async function expectCode(p: Promise<unknown>, code: OidcError["code"]) {
  await expect(p).rejects.toBeInstanceOf(OidcError);
  await expect(p).rejects.toMatchObject({ code });
}

const secrets = { nonce: "NONCE", codeVerifier: "verifier-verifier-verifier-verifier-verifier-1234" };

describe("OIDC relying party", () => {
  it("builds an authorization URL with PKCE S256, state and nonce", async () => {
    const s = newAuthRequestSecrets();
    const u = new URL(await rp().authorizationUrl(s));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toBe(pkceChallenge(s.codeVerifier));
    expect(u.searchParams.get("state")).toBe(s.state);
    expect(u.searchParams.get("nonce")).toBe(s.nonce);
    expect(u.searchParams.get("client_id")).toBe(CLIENT_ID);
  });

  it("accepts a valid flow and authenticates with private_key_jwt", async () => {
    const id = await rp().exchangeCode("code", secrets);
    expect(id.subject).toBe("subject-123");
    expect(id.userinfo.name).toBe("Test Person");
    expect(lastTokenRequest?.get("client_assertion_type")).toBe("urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    expect(lastTokenRequest?.get("code_verifier")).toBe(secrets.codeVerifier);
    expect(lastTokenRequest?.has("client_secret")).toBe(false);
  });

  it("rejects a discovery document for a different issuer", async () => {
    behaviour.discoveryIssuer = "https://evil.example";
    await expectCode(rp().discover(), "issuer_mismatch");
  });

  it("rejects an ID token signed by an unknown key", async () => {
    behaviour.signWithRogueKey = true;
    await expectCode(rp().exchangeCode("code", secrets), "invalid_id_token");
  });

  it("rejects the wrong issuer, audience or an expired token", async () => {
    behaviour.idTokenClaims = { iss: "https://other.example" };
    await expectCode(rp().exchangeCode("code", secrets), "invalid_id_token");
    behaviour.idTokenClaims = { aud: "someone-else" };
    await expectCode(rp().exchangeCode("code", secrets), "invalid_id_token");
    const past = Math.floor(Date.now() / 1000) - 3600;
    behaviour.idTokenClaims = { iat: past - 300, exp: past };
    await expectCode(rp().exchangeCode("code", secrets), "invalid_id_token");
  });

  it("rejects a multi-audience token whose azp is not this client", async () => {
    behaviour.idTokenClaims = { aud: [CLIENT_ID, "other"], azp: "other" };
    await expectCode(rp().exchangeCode("code", secrets), "invalid_id_token");
  });

  it("rejects a nonce mismatch (replay)", async () => {
    behaviour.idTokenClaims = { nonce: "SOMETHING-ELSE" };
    await expectCode(rp().exchangeCode("code", secrets), "nonce_mismatch");
  });

  it("rejects a token with no nonce", async () => {
    behaviour.idTokenClaims = { nonce: undefined };
    await expectCode(rp().exchangeCode("code", secrets), "invalid_id_token");
  });

  it("rejects userinfo for a different subject", async () => {
    behaviour.userinfoSub = "someone-else";
    await expectCode(rp().exchangeCode("code", secrets), "subject_mismatch");
  });

  it("verifies signed userinfo", async () => {
    behaviour.userinfo = "jws";
    expect((await rp().exchangeCode("code", secrets)).userinfo.name).toBe("Test Person");
  });

  it("fails closed on encrypted userinfo without a decryption key", async () => {
    behaviour.userinfo = "jwe";
    await expectCode(rp().exchangeCode("code", secrets), "encrypted_userinfo_unsupported");
  });

  it("decrypts encrypted userinfo when a key is configured", async () => {
    behaviour.userinfo = "jwe";
    const id = await rp({ userinfoDecryptionJwk: encPrivateJwk }).exchangeCode("code", secrets);
    expect(id.userinfo.name).toBe("Test Person");
  });

  it("surfaces token endpoint errors", async () => {
    behaviour.tokenStatus = 400;
    await expectCode(rp().exchangeCode("code", secrets), "token_exchange_failed");
  });

  it("fails closed when the provider is unreachable", async () => {
    await expectCode(rp({ issuer: "http://127.0.0.1:1" }).discover(), "discovery_failed");
  });
});
